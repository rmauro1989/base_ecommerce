/**
 * Reglas de precio de la tienda (puras, sin base de datos).
 * Montos en CLP enteros. Largos en metros con hasta 2 decimales.
 */
export type SaleUnit = "UNIT" | "METER" | "PACK";

export type LengthRules = {
  saleUnit: SaleUnit;
  lengthPresets: number[];
  allowCustomLength: boolean;
  minLength: number | null;
  maxLength: number | null;
  lengthStep: number | null;
};

export const MAX_QUANTITY = 999;

/** Trabaja en centímetros para evitar errores de punto flotante. */
const toCm = (meters: number) => Math.round(meters * 100);
const fmt = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 2 });

export function unitPrice(productPrice: number, priceOverride?: number | null): number {
  return priceOverride ?? productPrice;
}

export type LengthCheck = { ok: true; length: number | null } | { ok: false; error: string };

/** Valida el largo pedido según la forma de venta del producto. */
export function validateLength(rules: LengthRules, length: number | null | undefined): LengthCheck {
  if (rules.saleUnit !== "METER") {
    return length == null ? { ok: true, length: null } : { ok: false, error: "Este producto no se vende por metro." };
  }
  if (length == null || !Number.isFinite(length) || length <= 0) return { ok: false, error: "Indica el largo en metros." };
  if (Math.abs(length * 100 - toCm(length)) > 1e-6) return { ok: false, error: "Usa como máximo 2 decimales." };

  const cm = toCm(length);
  if (rules.lengthPresets.some((p) => toCm(p) === cm)) return { ok: true, length: cm / 100 };
  if (!rules.allowCustomLength) return { ok: false, error: "Elige uno de los largos disponibles." };

  const min = rules.minLength ?? 0.01;
  if (cm < toCm(min)) return { ok: false, error: `El largo mínimo es ${fmt(min)} m.` };
  if (rules.maxLength != null && cm > toCm(rules.maxLength)) return { ok: false, error: `El largo máximo es ${fmt(rules.maxLength)} m.` };
  if (rules.lengthStep) {
    const step = toCm(rules.lengthStep);
    if (step > 0 && cm % step !== 0) return { ok: false, error: `El largo debe ser múltiplo de ${fmt(rules.lengthStep)} m.` };
  }
  return { ok: true, length: cm / 100 };
}

/** Precio de una pieza: por metro se multiplica por el largo y se redondea al peso. */
export function piecePrice(saleUnit: SaleUnit, price: number, length: number | null): number {
  if (saleUnit === "METER") {
    if (length == null) throw new Error("Falta el largo para un producto por metro");
    return Math.round((price * toCm(length)) / 100);
  }
  return price;
}

export function linePrice(saleUnit: SaleUnit, price: number, quantity: number, length: number | null): number {
  return piecePrice(saleUnit, price, length) * quantity;
}

/** Cuánto stock consume una línea: metros (por metro) o unidades/empaques. */
export function stockRequired(saleUnit: SaleUnit, quantity: number, length: number | null): number {
  if (saleUnit === "METER") return (toCm(length ?? 0) * quantity) / 100;
  return quantity;
}

/** Precio de referencia por metro de un rollo (ej. rollo 100 m a $98.990 → $990/m). */
export function pricePerContentUnit(packPrice: number, packContent: number | null): number | null {
  if (!packContent || packContent <= 0) return null;
  return Math.round(packPrice / packContent);
}

// ─────────────────────────── Kits ───────────────────────────

export type KitComponent = {
  saleUnit: SaleUnit;
  /** Precio unitario del componente (por metro si es METER) */
  price: number;
  /** Cantidad por kit (unidades o metros) */
  quantity: number;
  /** Stock disponible del componente (unidades o metros) */
  stock: number;
};

/** Valor de los componentes comprados por separado. */
export function kitComponentsValue(items: KitComponent[]): number {
  return items.reduce((sum, i) => sum + (i.saleUnit === "METER" ? piecePrice("METER", i.price, i.quantity) : i.price * i.quantity), 0);
}

export function kitSavings(kitPrice: number, items: KitComponent[]) {
  const value = kitComponentsValue(items);
  const amount = Math.max(0, value - kitPrice);
  return { componentsValue: value, amount, percent: value > 0 ? Math.round((amount / value) * 100) : 0 };
}

/** Cuántos kits se pueden armar con el stock actual de sus componentes. */
export function kitAvailableStock(items: Pick<KitComponent, "quantity" | "stock">[]): number {
  if (items.length === 0) return 0;
  return Math.max(0, Math.min(...items.map((i) => (i.quantity > 0 ? Math.floor((toCm(i.stock) / toCm(i.quantity)) + 1e-9) : Infinity))));
}

/** Stock que consume cada componente al vender `kits` unidades del kit. */
export function kitStockRequired(items: { variantId: string; quantity: number }[], kits: number) {
  return items.map((i) => ({ variantId: i.variantId, amount: (toCm(i.quantity) * kits) / 100 }));
}
