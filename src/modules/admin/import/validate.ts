/**
 * Validación de la carga masiva (pura). Convierte filas + mapeo en un plan:
 * productos a crear/actualizar con sus variantes, y errores/advertencias por fila.
 */
import { slugify } from "@/lib/slug";
import { parseBool, parseDecimal, parseMoney, parseSaleUnit, parseStatus } from "./fields";

export type ImportContext = {
  categories: { id: string; slug: string; name: string }[];
  /** categoría → atributos permitidos (propios + heredados) */
  categoryFields: Record<string, { id: string; label: string; type: string; options: string[]; required: boolean }[]>;
  attributes: { id: string; key: string; label: string; type: string; options: string[] }[];
  /** SKU existente → producto/variante */
  existingSkus: Record<string, { productId: string; variantId: string; productName: string; categoryId: string | null; saleUnit: "UNIT" | "METER" | "PACK" }>;
  existingSlugs: string[];
};

export type RowReport = { row: number; sku: string; name: string; action: "create" | "update" | "skip"; errors: string[]; warnings: string[] };

export type PlannedVariant = { sku: string; name: string; stock: number | null; priceOverride: number | null; existingVariantId: string | null };

export type PlannedProduct = {
  key: string;
  existingProductId: string | null;
  rows: number[];
  name: string;
  slug: string | null;
  categoryId: string | null;
  brand: string | null;
  shortDescription: string | null;
  description: string | null;
  saleUnit: "UNIT" | "METER" | "PACK" | null;
  price: number | null;
  compareAtPrice: number | null;
  lengthPresets: number[] | null;
  allowCustomLength: boolean | null;
  minLength: number | null;
  maxLength: number | null;
  lengthStep: number | null;
  packLabel: string | null;
  packContent: number | null;
  status: "DRAFT" | "PUBLISHED" | null;
  images: string[];
  attributes: { attributeId: string; valueText?: string; valueNumber?: number; valueBool?: boolean }[];
  variants: PlannedVariant[];
};

export type ImportPlan = { rows: RowReport[]; products: PlannedProduct[]; summary: { create: number; update: number; skippedRows: number; errors: number; warnings: number } };

const isHttpsUrl = (u: string) => {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

/** Campos que deben estar asignados a alguna columna. */
export function missingRequiredMappings(mapping: Record<string, string>): string[] {
  const mapped = new Set(Object.values(mapping));
  return (["sku", "nombre", "precio"] as const).filter((f) => !mapped.has(f));
}

export function buildImportPlan(
  headers: string[],
  rawRows: string[][],
  mapping: Record<string, string>,
  ctx: ImportContext,
  opts: { overflowRows?: number[] } = {},
): ImportPlan {
  const reports: RowReport[] = [];
  const groups = new Map<string, PlannedProduct>();
  const seenSkus = new Map<string, number>();
  const groupHasError = new Set<string>();
  const rowGroup = new Map<number, string>();
  const catBy = (v: string) => {
    const s = slugify(v);
    return ctx.categories.find((c) => c.slug === v.trim().toLowerCase() || c.slug === s || slugify(c.name) === s) ?? null;
  };

  rawRows.forEach((cells, idx) => {
    const rowNum = idx + 2; // fila 1 = encabezado
    const get = (field: string) => {
      const i = headers.findIndex((h) => mapping[h] === field);
      return i >= 0 ? (cells[i] ?? "").trim() : "";
    };
    const errors: string[] = [];
    const warnings: string[] = [];
    const sku = get("sku").toUpperCase();
    const name = get("nombre");
    const existing = sku ? ctx.existingSkus[sku] : undefined;
    const action: RowReport["action"] = existing ? "update" : "create";
    const key = existing ? `id:${existing.productId}` : `new:${slugify(name)}`;
    const groupSoFar = groups.get(key);
    // Las filas siguientes de un producto nuevo son variantes: heredan los datos del producto
    const isVariantRow = !existing && !!groupSoFar;

    if (!sku) errors.push("Falta el SKU.");
    else if (sku.length > 60) errors.push("SKU demasiado largo.");
    else if (seenSkus.has(sku)) errors.push(`SKU repetido en el archivo (también en la fila ${seenSkus.get(sku)}).`);
    if (sku) seenSkus.set(sku, rowNum);
    if (!name && !existing) errors.push("Falta el nombre.");
    if (name.length > 150) errors.push("Nombre demasiado largo (máx. 150).");

    // Precio
    const priceRaw = get("precio");
    const price = priceRaw ? parseMoney(priceRaw) : null;
    if (Number.isNaN(price) || (price != null && price <= 0)) errors.push(`Precio inválido: "${priceRaw}".`);
    else if (price == null && !existing && !isVariantRow) errors.push("Falta el precio.");
    const compareRaw = get("precio_anterior");
    const compareAt = compareRaw ? parseMoney(compareRaw) : null;
    if (Number.isNaN(compareAt)) errors.push(`Precio anterior inválido: "${compareRaw}".`);
    else if (compareAt != null && price != null && !Number.isNaN(price) && compareAt <= price) warnings.push("El precio anterior no es mayor al precio: se ignora.");
    const variantPriceRaw = get("precio_variante");
    const variantPrice = variantPriceRaw ? parseMoney(variantPriceRaw) : null;
    if (Number.isNaN(variantPrice) || (variantPrice != null && variantPrice <= 0)) errors.push(`Precio de variante inválido: "${variantPriceRaw}".`);

    // Stock
    const stockRaw = get("stock");
    const stock = stockRaw ? parseDecimal(stockRaw) : null;
    if (Number.isNaN(stock) || (stock != null && stock < 0)) errors.push(`Stock inválido: "${stockRaw}".`);
    else if (stock == null && !existing) warnings.push("Sin stock: la variante se crea con 0.");

    // Forma de venta
    const suRaw = get("forma_venta");
    const su = parseSaleUnit(suRaw);
    if (su === "invalid") errors.push(`Forma de venta desconocida: "${suRaw}" (usa unidad, metro o rollo).`);
    const saleUnit = su === "invalid" ? null : (su ?? (existing || isVariantRow ? null : "UNIT"));
    const effectiveUnit = saleUnit ?? groupSoFar?.saleUnit ?? existing?.saleUnit ?? "UNIT";
    if (existing && saleUnit && saleUnit !== existing.saleUnit) warnings.push("Cambia la forma de venta de un producto existente: revisa su stock.");

    // Largos (por metro)
    const lengthsRaw = get("largos");
    let lengthPresets: number[] | null = null;
    if (lengthsRaw) {
      const parts = lengthsRaw
        .split(/[;|/\s]+/)
        .filter(Boolean)
        .map((x) => parseDecimal(x.trim()));
      if (parts.some((p) => p == null || Number.isNaN(p) || p <= 0)) errors.push(`Largos inválidos: "${lengthsRaw}" (ej. 5/10/25).`);
      else lengthPresets = [...new Set(parts as number[])].sort((a, b) => a - b);
    }
    const customRaw = get("medida_exacta");
    const allowCustom = customRaw ? parseBool(customRaw) : null;
    if (customRaw && allowCustom == null) errors.push(`"Permite medida exacta" debe ser si o no.`);
    const dec = (field: string, label: string) => {
      const raw = get(field);
      const n = raw ? parseDecimal(raw) : null;
      if (Number.isNaN(n) || (n != null && n <= 0)) {
        errors.push(`${label} inválido: "${raw}".`);
        return null;
      }
      return n;
    };
    const minLength = dec("largo_min", "Largo mínimo");
    const maxLength = dec("largo_max", "Largo máximo");
    const lengthStep = dec("largo_paso", "Tramo");
    const packContent = dec("contenido_empaque", "Contenido del empaque");
    const packLabel = get("empaque") || null;
    if (!existing && !isVariantRow) {
      if (effectiveUnit === "METER" && !lengthPresets?.length && !allowCustom) errors.push("Producto por metro sin largos ni medida exacta.");
      if (effectiveUnit === "PACK" && !packLabel) errors.push("Producto por rollo/caja sin nombre de empaque (ej. Rollo 100 m).");
    }
    if (effectiveUnit !== "METER" && (lengthsRaw || customRaw)) warnings.push("Largos ignorados: el producto no se vende por metro.");

    // Categoría
    const catRaw = get("categoria");
    const cat = catRaw ? catBy(catRaw) : null;
    if (catRaw && !cat) errors.push(`Categoría no encontrada: "${catRaw}".`);
    if (!catRaw && !existing && !isVariantRow) warnings.push("Sin categoría: no se podrá publicar.");
    const categoryId = cat?.id ?? groupSoFar?.categoryId ?? existing?.categoryId ?? null;

    // Atributos técnicos
    const allowed = categoryId ? (ctx.categoryFields[categoryId] ?? []) : [];
    const attributes: PlannedProduct["attributes"] = [];
    for (const h of headers) {
      const m = mapping[h];
      if (!m?.startsWith("attr:")) continue;
      const raw = (cells[headers.indexOf(h)] ?? "").trim();
      if (!raw) continue;
      const def = ctx.attributes.find((a) => a.key === m.slice(5));
      if (!def) continue;
      if (!allowed.some((a) => a.id === def.id)) {
        warnings.push(`"${def.label}" no aplica a la categoría: se ignora.`);
        continue;
      }
      if (def.type === "NUMBER") {
        const n = parseDecimal(raw);
        if (n == null || Number.isNaN(n)) errors.push(`${def.label}: "${raw}" no es un número.`);
        else attributes.push({ attributeId: def.id, valueNumber: n });
      } else if (def.type === "BOOLEAN") {
        const b = parseBool(raw);
        if (b == null) errors.push(`${def.label}: usa si o no.`);
        else attributes.push({ attributeId: def.id, valueBool: b });
      } else if (def.type === "SELECT") {
        const opt = def.options.find((o) => o.toLowerCase() === raw.toLowerCase());
        if (!opt) errors.push(`${def.label}: "${raw}" no está en la lista (${def.options.join(", ")}).`);
        else attributes.push({ attributeId: def.id, valueText: opt });
      } else attributes.push({ attributeId: def.id, valueText: raw.slice(0, 100) });
    }

    // Imágenes
    const images = get("imagenes")
      .split(/[;\s]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    const badImages = images.filter((u) => !isHttpsUrl(u));
    if (badImages.length) errors.push(`URL de imagen inválida (debe ser https): ${badImages[0]}`);
    if (images.length > 10) errors.push("Máximo 10 imágenes por fila.");

    // Estado
    const statusRaw = get("estado");
    const st = parseStatus(statusRaw);
    if (st === "invalid") errors.push(`Estado desconocido: "${statusRaw}" (usa borrador o publicado).`);
    const status = st === "invalid" ? null : st;

    // Agrupación: producto existente por id; nuevo por nombre
    rowGroup.set(rowNum, key);
    let g = groupSoFar;
    if (!g) {
      g = {
        key,
        existingProductId: existing?.productId ?? null,
        rows: [],
        name: name || existing?.productName || "",
        slug: null,
        categoryId: cat?.id ?? null,
        brand: get("marca") || null,
        shortDescription: get("descripcion_corta").slice(0, 300) || null,
        description: get("descripcion").slice(0, 5000) || null,
        saleUnit,
        price: Number.isNaN(price) ? null : price,
        compareAtPrice: compareAt != null && !Number.isNaN(compareAt) && price != null && compareAt > price ? compareAt : null,
        lengthPresets,
        allowCustomLength: allowCustom,
        minLength,
        maxLength,
        lengthStep,
        packLabel,
        packContent,
        status,
        images: [],
        attributes,
        variants: [],
      };
      if (!existing) {
        let slug = slugify(name) || "producto";
        for (let i = 2; ctx.existingSlugs.includes(slug); i++) slug = `${slugify(name)}-${i}`;
        g.slug = slug;
      }
      groups.set(key, g);
    } else {
      // Filas siguientes del mismo producto: solo aportan variantes (y fotos)
      if (price != null && g.price != null && price !== g.price && !variantPrice) {
        warnings.push(`Precio distinto al de la primera fila del producto (${g.price}): usa "Precio propio de la variante" si es intencional.`);
      }
    }
    g.rows.push(rowNum);
    for (const img of images) if (!g.images.includes(img)) g.images.push(img);
    if (sku && !g.variants.some((v) => v.sku === sku)) {
      g.variants.push({
        sku,
        name: get("variante") || (existing ? "" : "Por defecto"),
        stock: stock == null || Number.isNaN(stock) ? null : stock,
        priceOverride: variantPrice == null || Number.isNaN(variantPrice) ? null : variantPrice,
        existingVariantId: existing?.variantId ?? null,
      });
    }

    if (opts.overflowRows?.includes(rowNum)) {
      errors.push("La fila tiene más columnas que el encabezado: revisa separadores (si usas ; en el CSV, separa los largos con /).");
    }
    if (errors.length) groupHasError.add(key);
    reports.push({ row: rowNum, sku, name: name || existing?.productName || "", action, errors, warnings });
  });

  // Advertencias de publicación para productos nuevos
  for (const g of groups.values()) {
    if (g.existingProductId || g.status !== "PUBLISHED") continue;
    const missing: string[] = [];
    if (!g.categoryId) missing.push("categoría");
    if (!g.images.length) missing.push("foto");
    const required = g.categoryId ? (ctx.categoryFields[g.categoryId] ?? []).filter((f) => f.required) : [];
    for (const r of required) if (!g.attributes.some((a) => a.attributeId === r.id)) missing.push(r.label);
    if (missing.length) {
      const first = reports.find((r) => r.row === g.rows[0]);
      first?.warnings.push(`Quedará en borrador (falta: ${missing.join(", ")}).`);
    }
  }

  // Si una fila de un producto tiene errores, se omite el producto completo
  for (const r of reports) {
    const key = rowGroup.get(r.row)!;
    if (groupHasError.has(key)) {
      r.action = "skip";
      if (!r.errors.length) r.errors.push("Se omite porque otra fila del mismo producto tiene errores.");
    }
  }
  const products = [...groups.values()].filter((g) => !groupHasError.has(g.key));
  return {
    rows: reports,
    products,
    summary: {
      create: products.filter((p) => !p.existingProductId).length,
      update: products.filter((p) => p.existingProductId).length,
      skippedRows: reports.filter((r) => r.action === "skip").length,
      errors: reports.reduce((s, r) => s + r.errors.length, 0),
      warnings: reports.reduce((s, r) => s + r.warnings.length, 0),
    },
  };
}
