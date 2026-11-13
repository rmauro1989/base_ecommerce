/**
 * Parámetros del catálogo en la URL: ?q=&orden=&pagina=&f.amperaje=10,16
 * Los filtros por atributo usan el prefijo "f." + clave del atributo.
 */
import { z } from "zod";

export const SORTS = {
  relevancia: "Más vendidos",
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  nombre: "Nombre A–Z",
  nuevos: "Más nuevos",
} as const;
export type SortKey = keyof typeof SORTS;

export const PAGE_SIZE = 12;

export type CatalogParams = {
  q: string;
  sort: SortKey;
  page: number;
  /** clave de atributo → valores seleccionados */
  attrs: Record<string, string[]>;
};

const baseSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  orden: z.enum(Object.keys(SORTS) as [SortKey, ...SortKey[]]).catch("relevancia"),
  pagina: z.coerce.number().int().min(1).max(500).catch(1),
});

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseCatalogParams(raw: RawParams): CatalogParams {
  const base = baseSchema.parse({ q: first(raw.q) ?? "", orden: first(raw.orden), pagina: first(raw.pagina) });
  const attrs: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("f.") || value == null) continue;
    const attrKey = key.slice(2);
    if (!/^[a-z0-9_]{1,40}$/.test(attrKey)) continue;
    const values = (Array.isArray(value) ? value : [value])
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter((v) => v.length > 0 && v.length <= 60)
      .slice(0, 20);
    if (values.length) attrs[attrKey] = [...new Set(values)];
  }
  return { q: base.q, sort: base.orden, page: base.pagina, attrs };
}

/** Construye la query string (para enlaces de paginación, orden y filtros). */
export function catalogQueryString(p: Partial<CatalogParams>): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.sort && p.sort !== "relevancia") sp.set("orden", p.sort);
  for (const [k, vals] of Object.entries(p.attrs ?? {})) if (vals.length) sp.set(`f.${k}`, vals.join(","));
  if (p.page && p.page > 1) sp.set("pagina", String(p.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function toggleAttrValue(attrs: Record<string, string[]>, key: string, value: string) {
  const current = attrs[key] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const copy = { ...attrs, [key]: next };
  if (next.length === 0) delete copy[key];
  return copy;
}
