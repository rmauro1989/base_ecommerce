/** Cálculo de despacho por comuna (puro). */
export type ZoneLike = {
  id: string;
  name: string;
  comunas: string[];
  price: number;
  freeShippingOver: number | null;
  estimatedDays: string | null;
  isFallback: boolean;
  active: boolean;
};

export function normalizeComuna(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function findZoneForComuna<Z extends ZoneLike>(zones: Z[], comuna: string): Z | null {
  const c = normalizeComuna(comuna);
  if (!c) return null;
  const active = zones.filter((z) => z.active);
  return active.find((z) => z.comunas.some((x) => normalizeComuna(x) === c)) ?? active.find((z) => z.isFallback) ?? null;
}

export function shippingCost(zone: Pick<ZoneLike, "price" | "freeShippingOver">, subtotal: number): number {
  if (zone.freeShippingOver != null && subtotal >= zone.freeShippingOver) return 0;
  return zone.price;
}
