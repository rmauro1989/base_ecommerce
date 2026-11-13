import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/slug";
import type { BulkAction, ProductFormData } from "./schemas";
import { adjustPrice, isReadyToPublish, productReadiness } from "./readiness";

export class ProductValidationError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Tx = Prisma.TransactionClient;

/** Atributos sugeridos para una categoría: los suyos + los heredados de sus ancestros. */
export async function getCategoryAttributeFields(categoryId: string | null, client: Tx | typeof db = db) {
  if (!categoryId) return [];
  const chain: string[] = [];
  let current: string | null = categoryId;
  while (current && chain.length < 10) {
    chain.unshift(current);
    const c: { parentId: string | null } | null = await client.category.findUnique({ where: { id: current }, select: { parentId: true } });
    current = c?.parentId ?? null;
  }
  const links = await client.categoryAttribute.findMany({
    where: { categoryId: { in: chain } },
    include: { attribute: true },
    orderBy: [{ position: "asc" }],
  });
  // Ordenar: primero los del ancestro más lejano; si se repite, gana "required"
  const byId = new Map<string, { id: string; key: string; label: string; type: string; unit: string | null; options: string[]; required: boolean }>();
  for (const cat of chain) {
    for (const l of links.filter((x) => x.categoryId === cat)) {
      const prev = byId.get(l.attributeId);
      byId.set(l.attributeId, {
        id: l.attribute.id,
        key: l.attribute.key,
        label: l.attribute.label,
        type: l.attribute.type,
        unit: l.attribute.unit,
        options: l.attribute.options,
        required: (prev?.required ?? false) || l.required,
      });
    }
  }
  return [...byId.values()];
}

/** Convierte el texto del formulario al campo correcto según el tipo del atributo. */
export function parseAttributeValue(type: string, raw: string): { valueText?: string | null; valueNumber?: number | null; valueBool?: boolean | null } | "invalid" | null {
  const v = raw.trim();
  if (!v) return null;
  if (type === "NUMBER") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? { valueNumber: n } : "invalid";
  }
  if (type === "BOOLEAN") {
    const t = v.toLowerCase();
    if (["si", "sí", "true", "1", "x"].includes(t)) return { valueBool: true };
    if (["no", "false", "0"].includes(t)) return { valueBool: false };
    return "invalid";
  }
  return { valueText: v };
}

async function uniqueSlug(tx: Tx, base: string, excludeId?: string) {
  const root = slugify(base) || "producto";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const exists = await tx.product.findFirst({ where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new ProductValidationError("No se pudo generar un slug único.");
}

/** Crea o actualiza un producto completo. Si se pide publicar, exige el checklist. */
export async function saveProduct(data: ProductFormData, id?: string | null): Promise<{ id: string; slug: string }> {
  return db.$transaction(
    async (tx) => {
      const existing = id ? await tx.product.findUnique({ where: { id }, include: { variants: true } }) : null;
      if (id && !existing) throw new ProductValidationError("El producto no existe.");

      // Slug
      let slug = data.slug ? data.slug : existing?.slug ?? (await uniqueSlug(tx, data.name));
      if (data.slug) {
        const clash = await tx.product.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
        if (clash) throw new ProductValidationError("Ese slug ya está en uso.", { slug: "Ya existe otro producto con este slug" });
      }
      slug ||= await uniqueSlug(tx, data.name, id ?? undefined);

      // Ficha técnica
      const fields = await getCategoryAttributeFields(data.categoryId, tx);
      const allowedAttrIds = new Set(fields.map((f) => f.id));
      const attrRows: Prisma.ProductAttributeValueCreateManyInput[] = [];
      const fieldErrors: Record<string, string> = {};
      for (const [attributeId, raw] of Object.entries(data.attributes)) {
        const def = fields.find((f) => f.id === attributeId);
        if (!def || !allowedAttrIds.has(attributeId)) continue; // atributos de otra categoría se descartan
        const parsed = parseAttributeValue(def.type, raw);
        if (parsed === "invalid") {
          fieldErrors[`attributes.${attributeId}`] = def.type === "NUMBER" ? "Debe ser un número" : "Valor inválido";
          continue;
        }
        if (def.type === "SELECT" && parsed?.valueText && def.options.length && !def.options.includes(parsed.valueText)) {
          fieldErrors[`attributes.${attributeId}`] = "Elige una opción de la lista";
          continue;
        }
        if (parsed) attrRows.push({ productId: "", attributeId, ...parsed });
      }
      if (Object.keys(fieldErrors).length) throw new ProductValidationError("Revisa la ficha técnica.", fieldErrors);

      // Kits: los componentes deben existir y no ser kits
      if (data.type === "KIT" && data.kitItems.length) {
        const comps = await tx.productVariant.findMany({ where: { id: { in: data.kitItems.map((k) => k.variantId) } }, include: { product: { select: { type: true, id: true } } } });
        if (comps.length !== data.kitItems.length) throw new ProductValidationError("Algún componente del kit ya no existe.", { kitItems: "Componente inválido" });
        if (comps.some((c) => c.product.type === "KIT" || c.product.id === id)) throw new ProductValidationError("Un kit no puede contener otros kits.", { kitItems: "Componente inválido" });
      }

      // Checklist para publicar
      if (data.status === "PUBLISHED") {
        const readiness = productReadiness({
          name: data.name,
          price: data.price,
          categoryId: data.categoryId,
          imageCount: data.images.length,
          shortDescription: data.shortDescription,
          type: data.type,
          saleUnit: data.saleUnit,
          lengthPresets: data.lengthPresets,
          allowCustomLength: data.allowCustomLength,
          totalStock: data.variants.reduce((s, v) => s + v.stock, 0),
          kitItemCount: data.kitItems.length,
          requiredAttributes: fields.filter((f) => f.required).map((f) => ({ label: f.label, filled: attrRows.some((r) => r.attributeId === f.id) })),
        });
        if (!isReadyToPublish(readiness)) {
          const missing = readiness.filter((r) => r.blocking && !r.ok).map((r) => r.label);
          throw new ProductValidationError(`No se puede publicar todavía. Falta: ${missing.join(", ")}. Guárdalo como borrador.`, { status: "Checklist incompleto" });
        }
      }

      const base = {
        name: data.name,
        slug,
        brand: data.brand,
        shortDescription: data.shortDescription,
        description: data.description,
        type: data.type,
        status: data.status,
        categoryId: data.categoryId,
        saleUnit: data.type === "KIT" ? ("UNIT" as const) : data.saleUnit,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        lengthPresets: data.saleUnit === "METER" ? [...new Set(data.lengthPresets)].sort((a, b) => a - b) : [],
        allowCustomLength: data.saleUnit === "METER" && data.allowCustomLength,
        minLength: data.saleUnit === "METER" ? data.minLength : null,
        maxLength: data.saleUnit === "METER" ? data.maxLength : null,
        lengthStep: data.saleUnit === "METER" ? data.lengthStep : null,
        packContent: data.saleUnit === "PACK" ? data.packContent : null,
        packLabel: data.saleUnit === "PACK" ? data.packLabel : null,
        featured: data.featured,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        publishedAt: data.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
      };

      const product = existing ? await tx.product.update({ where: { id: existing.id }, data: base }) : await tx.product.create({ data: base });
      const pid = product.id;

      // Fotos (reemplazo completo, en el orden recibido)
      await tx.productImage.deleteMany({ where: { productId: pid } });
      if (data.images.length) {
        await tx.productImage.createMany({ data: data.images.map((img, i) => ({ productId: pid, assetId: img.assetId, alt: img.alt, position: i })) });
      }

      // Variantes: actualizar, crear y quitar (si una variante está en un kit o tiene historial se desactiva)
      const keepIds = new Set(data.variants.map((v) => v.id).filter(Boolean) as string[]);
      for (const old of existing?.variants ?? []) {
        if (keepIds.has(old.id)) continue;
        const usedInKit = await tx.kitItem.count({ where: { variantId: old.id } });
        if (usedInKit) await tx.productVariant.update({ where: { id: old.id }, data: { active: false } });
        else await tx.productVariant.delete({ where: { id: old.id } });
      }
      for (const [i, v] of data.variants.entries()) {
        const payload = {
          name: v.name,
          sku: v.sku,
          priceOverride: data.type === "KIT" ? null : v.priceOverride,
          stock: data.type === "KIT" ? 0 : v.stock,
          active: v.active,
          ...(v.options ? { options: v.options } : {}),
          position: i,
          isDefault: i === 0,
        };
        if (v.id && existing?.variants.some((x) => x.id === v.id)) await tx.productVariant.update({ where: { id: v.id }, data: payload });
        else await tx.productVariant.create({ data: { ...payload, productId: pid } });
      }

      // Ficha técnica
      await tx.productAttributeValue.deleteMany({ where: { productId: pid } });
      if (attrRows.length) await tx.productAttributeValue.createMany({ data: attrRows.map((r) => ({ ...r, productId: pid })) });

      // Relacionados ("Se conecta con")
      await tx.productRelation.deleteMany({ where: { fromId: pid } });
      const related = [...new Set(data.relatedIds)].filter((r) => r !== pid);
      if (related.length) await tx.productRelation.createMany({ data: related.map((toId, i) => ({ fromId: pid, toId, position: i })) });

      // Componentes del kit
      await tx.kitItem.deleteMany({ where: { kitId: pid } });
      if (data.type === "KIT" && data.kitItems.length) {
        await tx.kitItem.createMany({ data: data.kitItems.map((k, i) => ({ kitId: pid, variantId: k.variantId, quantity: k.quantity, position: i })) });
      }

      return { id: pid, slug: product.slug };
    },
    { timeout: 20_000 },
  );
}

export type BulkResult = { updated: number; skipped: string[] };

export async function bulkUpdateProducts(input: BulkAction): Promise<BulkResult> {
  const ids = [...new Set(input.ids)];
  if (input.action === "price") {
    return db.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: ids } }, include: { variants: true } });
      for (const p of products) {
        await tx.product.update({
          where: { id: p.id },
          data: {
            price: adjustPrice(p.price, input.percent, input.roundTo),
            // Si sube por sobre el precio anterior, se elimina la "oferta"
            compareAtPrice: p.compareAtPrice && p.compareAtPrice > adjustPrice(p.price, input.percent, input.roundTo) ? p.compareAtPrice : null,
          },
        });
        for (const v of p.variants.filter((x) => x.priceOverride != null)) {
          await tx.productVariant.update({ where: { id: v.id }, data: { priceOverride: adjustPrice(v.priceOverride!, input.percent, input.roundTo) } });
        }
      }
      return { updated: products.length, skipped: [] };
    });
  }
  if (input.action === "hide") {
    const r = await db.product.updateMany({ where: { id: { in: ids } }, data: { status: "DRAFT" } });
    return { updated: r.count, skipped: [] };
  }
  if (input.action === "category") {
    const cat = await db.category.findUnique({ where: { id: input.categoryId } });
    if (!cat) throw new ProductValidationError("La categoría no existe.");
    const r = await db.product.updateMany({ where: { id: { in: ids } }, data: { categoryId: input.categoryId } });
    return { updated: r.count, skipped: [] };
  }
  // publish: solo los que cumplen el checklist
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { images: true, kitItems: true } }, variants: { select: { stock: true } }, attributes: { select: { attributeId: true } } },
  });
  const skipped: string[] = [];
  const ok: string[] = [];
  for (const p of products) {
    const fields = await getCategoryAttributeFields(p.categoryId);
    const readiness = productReadiness({
      name: p.name,
      price: p.price,
      categoryId: p.categoryId,
      imageCount: p._count.images,
      shortDescription: p.shortDescription,
      type: p.type,
      saleUnit: p.saleUnit,
      lengthPresets: p.lengthPresets.map(Number),
      allowCustomLength: p.allowCustomLength,
      totalStock: p.variants.reduce((s, v) => s + Number(v.stock), 0),
      kitItemCount: p._count.kitItems,
      requiredAttributes: fields.filter((f) => f.required).map((f) => ({ label: f.label, filled: p.attributes.some((a) => a.attributeId === f.id) })),
    });
    if (isReadyToPublish(readiness)) ok.push(p.id);
    else skipped.push(p.name);
  }
  const now = new Date();
  await db.product.updateMany({ where: { id: { in: ok }, publishedAt: null }, data: { publishedAt: now } });
  const r = await db.product.updateMany({ where: { id: { in: ok } }, data: { status: "PUBLISHED" } });
  return { updated: r.count, skipped };
}

// ─────────────────────────── Consultas del admin ───────────────────────────

export const ADMIN_PAGE_SIZE = 25;

export async function listAdminProducts(f: { q: string; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; categoryId?: string; type?: "SIMPLE" | "KIT"; page: number }) {
  const where: Prisma.ProductWhereInput = {
    ...(f.status ? { status: f.status } : { status: { not: "ARCHIVED" } }),
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { brand: { contains: f.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: f.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (f.page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        images: { take: 1, orderBy: { position: "asc" }, include: { asset: { select: { url: true } } } },
        variants: { where: { active: true }, select: { stock: true, sku: true } },
      },
    }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)), rows };
}

export async function getProductForEdit(id: string) {
  const p = await db.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" }, include: { asset: { select: { id: true, url: true } } } },
      variants: { orderBy: { position: "asc" } },
      attributes: true,
      relatedFrom: { orderBy: { position: "asc" }, include: { to: { select: { id: true, name: true } } } },
      kitItems: { orderBy: { position: "asc" }, include: { variant: { include: { product: { select: { name: true, saleUnit: true } } } } } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    initial: {
      name: p.name,
      slug: p.slug,
      brand: p.brand ?? "",
      shortDescription: p.shortDescription ?? "",
      description: p.description ?? "",
      type: p.type,
      status: p.status,
      categoryId: p.categoryId ?? "",
      saleUnit: p.saleUnit,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      lengthPresets: p.lengthPresets.map(Number),
      allowCustomLength: p.allowCustomLength,
      minLength: p.minLength == null ? null : Number(p.minLength),
      maxLength: p.maxLength == null ? null : Number(p.maxLength),
      lengthStep: p.lengthStep == null ? null : Number(p.lengthStep),
      packContent: p.packContent == null ? null : Number(p.packContent),
      packLabel: p.packLabel ?? "",
      featured: p.featured,
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      images: p.images.map((i) => ({ assetId: i.asset.id, url: i.asset.url, alt: i.alt ?? "" })),
      variants: p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku ?? "",
        priceOverride: v.priceOverride,
        stock: Number(v.stock),
        active: v.active,
      })),
      attributes: Object.fromEntries(
        p.attributes.map((a) => [a.attributeId, a.valueNumber != null ? String(Number(a.valueNumber)) : a.valueBool != null ? (a.valueBool ? "si" : "no") : (a.valueText ?? "")]),
      ),
      related: p.relatedFrom.map((r) => ({ id: r.to.id, name: r.to.name })),
      kitItems: p.kitItems.map((k) => ({
        variantId: k.variantId,
        quantity: Number(k.quantity),
        label: `${k.variant.product.name}${k.variant.name !== "Por defecto" ? ` · ${k.variant.name}` : ""}`,
        saleUnit: k.variant.product.saleUnit,
      })),
    },
  };
}

/** Mapa categoría → atributos sugeridos (propios + heredados), calculado en memoria. */
export async function getAllCategoryFieldsMap() {
  const [cats, links] = await Promise.all([
    db.category.findMany({ select: { id: true, parentId: true } }),
    db.categoryAttribute.findMany({ include: { attribute: true }, orderBy: { position: "asc" } }),
  ]);
  const parent = new Map(cats.map((c) => [c.id, c.parentId]));
  const map: Record<string, { id: string; label: string; type: string; unit: string | null; options: string[]; required: boolean }[]> = {};
  for (const c of cats) {
    const chain: string[] = [];
    let cur: string | null = c.id;
    while (cur && chain.length < 10) {
      chain.unshift(cur);
      cur = parent.get(cur) ?? null;
    }
    const byId = new Map<string, (typeof map)[string][number]>();
    for (const cid of chain) {
      for (const l of links.filter((x) => x.categoryId === cid)) {
        const prev = byId.get(l.attributeId);
        byId.set(l.attributeId, { id: l.attribute.id, label: l.attribute.label, type: l.attribute.type, unit: l.attribute.unit, options: l.attribute.options, required: (prev?.required ?? false) || l.required });
      }
    }
    map[c.id] = [...byId.values()];
  }
  return map;
}

export type ProductEditData = NonNullable<Awaited<ReturnType<typeof getProductForEdit>>>;

/** Opciones para selectores del formulario (categorías, productos para relacionar, componentes de kit). */
export async function getProductFormOptions() {
  const [categories, attributes, variants] = await Promise.all([
    db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }),
    db.attributeDefinition.findMany({ orderBy: { position: "asc" } }),
    db.productVariant.findMany({
      where: { active: true, product: { type: "SIMPLE", status: { not: "ARCHIVED" } } },
      include: { product: { select: { id: true, name: true, saleUnit: true, price: true } } },
      orderBy: [{ product: { name: "asc" } }, { position: "asc" }],
    }),
  ]);
  // Árbol aplanado con indentación
  const byParent = new Map<string | null, typeof categories>();
  for (const c of categories) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  const flat: { id: string; label: string }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      flat.push({ id: c.id, label: `${"— ".repeat(depth)}${c.name}` });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  const products = new Map<string, string>();
  for (const v of variants) products.set(v.product.id, v.product.name);
  return {
    categories: flat,
    attributes: attributes.map((a) => ({ id: a.id, label: a.label, type: a.type, unit: a.unit, options: a.options })),
    products: [...products.entries()].map(([id, name]) => ({ id, name })),
    componentVariants: variants.map((v) => ({
      id: v.id,
      label: `${v.product.name}${v.name !== "Por defecto" ? ` · ${v.name}` : ""}`,
      saleUnit: v.product.saleUnit,
      price: v.priceOverride ?? v.product.price,
    })),
  };
}
