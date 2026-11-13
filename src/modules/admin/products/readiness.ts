/** Checklist "listo para publicar" (puro: lo usa el formulario y el servidor). */
export type ReadinessInput = {
  name: string;
  price: number;
  categoryId: string | null;
  imageCount: number;
  shortDescription: string | null;
  type: "SIMPLE" | "KIT";
  saleUnit: "UNIT" | "METER" | "PACK";
  lengthPresets: number[];
  allowCustomLength: boolean;
  totalStock: number;
  kitItemCount: number;
  /** atributos obligatorios de la categoría y si tienen valor */
  requiredAttributes: { label: string; filled: boolean }[];
};

export type ReadinessItem = { id: string; label: string; ok: boolean; blocking: boolean };

export function productReadiness(p: ReadinessInput): ReadinessItem[] {
  const items: ReadinessItem[] = [
    { id: "name", label: "Nombre", ok: p.name.trim().length >= 2, blocking: true },
    { id: "price", label: "Precio mayor a $0", ok: p.price > 0, blocking: true },
    { id: "category", label: "Categoría asignada", ok: !!p.categoryId, blocking: true },
    { id: "image", label: "Al menos una foto", ok: p.imageCount > 0, blocking: true },
    { id: "short", label: "Descripción corta", ok: !!p.shortDescription?.trim(), blocking: false },
  ];
  if (p.saleUnit === "METER") items.push({ id: "lengths", label: "Largos de venta definidos", ok: p.lengthPresets.length > 0 || p.allowCustomLength, blocking: true });
  if (p.type === "KIT") items.push({ id: "kit", label: "Kit con al menos 2 componentes", ok: p.kitItemCount >= 2, blocking: true });
  else items.push({ id: "stock", label: "Stock disponible", ok: p.totalStock > 0, blocking: false });
  for (const a of p.requiredAttributes) items.push({ id: `attr:${a.label}`, label: `Ficha técnica: ${a.label}`, ok: a.filled, blocking: true });
  return items;
}

export function isReadyToPublish(items: ReadinessItem[]) {
  return items.every((i) => i.ok || !i.blocking);
}

/** Nuevo precio tras un ajuste porcentual, redondeado (ej. a $10). */
export function adjustPrice(price: number, percent: number, roundTo = 10): number {
  const next = Math.round((price * (1 + percent / 100)) / roundTo) * roundTo;
  return Math.max(roundTo, next);
}
