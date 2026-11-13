/**
 * Campos que se pueden importar y detección automática de columnas.
 * Los atributos técnicos se mapean como "attr:<clave>".
 */
export type ImportField = {
  key: string;
  label: string;
  /** Encabezados alternativos que se reconocen automáticamente */
  aliases: string[];
  required?: boolean;
  help: string;
  example: string;
};

export const IMPORT_FIELDS: ImportField[] = [
  { key: "sku", label: "SKU", aliases: ["codigo", "código", "cod", "sku variante"], required: true, help: "Código único de la variante. Si ya existe, la fila actualiza ese producto.", example: "THHN60-NG" },
  { key: "nombre", label: "Nombre", aliases: ["producto", "nombre producto", "titulo", "título"], required: true, help: "Filas con el mismo nombre se agrupan como variantes de un producto.", example: "Cable THHN 6 mm²" },
  { key: "variante", label: "Variante", aliases: ["color", "opcion", "opción"], help: "Nombre de la variante (ej. color). Vacío = 'Por defecto'.", example: "Negro" },
  { key: "categoria", label: "Categoría", aliases: ["category", "familia", "rubro"], help: "Slug o nombre de una categoría existente.", example: "cable-unipolar" },
  { key: "marca", label: "Marca", aliases: ["brand", "fabricante"], help: "", example: "Conducta" },
  { key: "descripcion_corta", label: "Descripción corta", aliases: ["resumen", "bajada"], help: "Máx. 300 caracteres.", example: "Conductor para alimentadores" },
  { key: "descripcion", label: "Descripción", aliases: ["detalle", "descripcion larga", "descripción larga"], help: "", example: "" },
  { key: "forma_venta", label: "Forma de venta", aliases: ["unidad venta", "venta", "unidad"], help: "unidad, metro o rollo (también: caja, empaque). Vacío = unidad.", example: "metro" },
  { key: "precio", label: "Precio", aliases: ["precio venta", "valor", "price", "precio clp"], required: true, help: "CLP con IVA. Por metro si la forma de venta es metro.", example: "1490" },
  { key: "precio_anterior", label: "Precio anterior", aliases: ["precio normal", "precio lista", "antes"], help: "Opcional, se muestra tachado.", example: "" },
  { key: "precio_variante", label: "Precio propio de la variante", aliases: ["precio especial"], help: "Opcional: si esta variante cuesta distinto al precio del producto.", example: "" },
  { key: "stock", label: "Stock", aliases: ["cantidad", "existencia", "inventario"], help: "Unidades, metros (si es por metro) o empaques.", example: "300" },
  { key: "largos", label: "Largos predefinidos", aliases: ["largos metros", "cortes"], help: "Solo por metro. Separados por / (ej. 5/10/25/50).", example: "5/10/25/50" },
  { key: "medida_exacta", label: "Permite medida exacta", aliases: ["corte a medida"], help: "si / no", example: "si" },
  { key: "largo_min", label: "Largo mínimo (m)", aliases: ["minimo", "mínimo"], help: "", example: "1" },
  { key: "largo_max", label: "Largo máximo (m)", aliases: ["maximo", "máximo"], help: "", example: "100" },
  { key: "largo_paso", label: "Tramos de (m)", aliases: ["paso", "multiplo", "múltiplo"], help: "Ej. 0,5", example: "0,5" },
  { key: "empaque", label: "Nombre del empaque", aliases: ["presentacion", "presentación"], help: "Solo rollo/caja. Ej. Rollo 100 m", example: "" },
  { key: "contenido_empaque", label: "Contenido del empaque", aliases: ["contenido"], help: "Metros o unidades por empaque.", example: "" },
  { key: "imagenes", label: "Imágenes (URLs)", aliases: ["imagen", "fotos", "foto", "image", "images"], help: "URLs https separadas por espacio (se descargan y optimizan).", example: "" },
  { key: "estado", label: "Estado", aliases: ["status", "publicado"], help: "borrador o publicado. Si falta algo del checklist queda en borrador.", example: "publicado" },
];

export const IGNORE = "__ignore__";

export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Propone un mapeo columna → campo según el encabezado. */
export function autoMap(headers: string[], attributes: { key: string; label: string }[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const candidates: [string, string][] = [];
  for (const f of IMPORT_FIELDS) for (const name of [f.key, f.label, ...f.aliases]) candidates.push([normalizeHeader(name), f.key]);
  for (const a of attributes) {
    for (const name of [a.key, a.label, `attr ${a.key}`, `attr:${a.key}`]) candidates.push([normalizeHeader(name), `attr:${a.key}`]);
  }
  for (const h of headers) {
    const n = normalizeHeader(h);
    const hit = candidates.find(([c, key]) => c === n && !used.has(key));
    if (hit) {
      map[h] = hit[1];
      used.add(hit[1]);
    } else {
      map[h] = IGNORE;
    }
  }
  return map;
}

// ─────────────────────────── Lectura de valores ───────────────────────────

/** Montos CLP: "$12.990" → 12990, 12990.0 → 12990. */
export function parseMoney(v: string): number | null {
  const s = v.replace(/\s|\$|clp/gi, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Math.round(Number(s.replace(/\./g, "").replace(",", ".")));
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

/** Decimales: "2,5" → 2.5, "2.5" → 2.5, "1.000" → 1000, "1.000,5" → 1000.5 */
export function parseDecimal(v: string): number | null {
  const s = v.replace(/\s/g, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function parseBool(v: string): boolean | null {
  const s = normalizeHeader(v);
  if (!s) return null;
  if (["si", "s", "yes", "y", "true", "1", "x", "verdadero"].includes(s)) return true;
  if (["no", "n", "false", "0", "falso"].includes(s)) return false;
  return null;
}

export function parseSaleUnit(v: string): "UNIT" | "METER" | "PACK" | null | "invalid" {
  const s = normalizeHeader(v);
  if (!s) return null;
  if (["unidad", "un", "u", "unit", "por unidad", "c u"].includes(s)) return "UNIT";
  if (["metro", "m", "mt", "mts", "metros", "por metro", "meter"].includes(s)) return "METER";
  if (["rollo", "caja", "empaque", "pack", "paquete", "bobina", "por rollo", "por caja"].includes(s)) return "PACK";
  return "invalid";
}

export function parseStatus(v: string): "DRAFT" | "PUBLISHED" | null | "invalid" {
  const s = normalizeHeader(v);
  if (!s) return null;
  if (["borrador", "draft", "oculto", "no"].includes(s)) return "DRAFT";
  if (["publicado", "published", "activo", "si", "visible"].includes(s)) return "PUBLISHED";
  return "invalid";
}
