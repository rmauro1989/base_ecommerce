import { describe, expect, it } from "vitest";
import {
  kitAvailableStock,
  kitComponentsValue,
  kitSavings,
  kitStockRequired,
  linePrice,
  piecePrice,
  pricePerContentUnit,
  stockRequired,
  validateLength,
  type LengthRules,
} from "@/modules/catalog/pricing";

const cable: LengthRules = {
  saleUnit: "METER",
  lengthPresets: [5, 10, 25, 50, 100],
  allowCustomLength: true,
  minLength: 1,
  maxLength: 100,
  lengthStep: 0.5,
};

describe("venta por metro", () => {
  it("precio = precio por metro × largo, redondeado al peso", () => {
    expect(piecePrice("METER", 690, 10)).toBe(6900);
    expect(piecePrice("METER", 690, 2.5)).toBe(1725);
    expect(piecePrice("METER", 333, 1.5)).toBe(500); // 499,5 → 500
    expect(piecePrice("METER", 490, 0.1 + 0.2)).toBe(147); // sin error de flotante
  });

  it("línea = precio de la pieza × cantidad de piezas", () => {
    expect(linePrice("METER", 690, 3, 10)).toBe(20700);
    expect(linePrice("METER", 690, 2, 7.5)).toBe(10350);
  });

  it("acepta largos predefinidos aunque no se permita medida exacta", () => {
    expect(validateLength({ ...cable, allowCustomLength: false }, 25)).toEqual({ ok: true, length: 25 });
    expect(validateLength({ ...cable, allowCustomLength: false }, 7).ok).toBe(false);
  });

  it("valida medida exacta: mínimo, máximo, múltiplo y decimales", () => {
    expect(validateLength(cable, 7.5)).toEqual({ ok: true, length: 7.5 });
    expect(validateLength(cable, 0.5).ok).toBe(false);
    expect(validateLength(cable, 120).ok).toBe(false);
    expect(validateLength(cable, 7.3).ok).toBe(false);
    expect(validateLength(cable, 7.555).ok).toBe(false);
    expect(validateLength(cable, null).ok).toBe(false);
    expect(validateLength(cable, -3).ok).toBe(false);
  });

  it("rechaza largo en productos que no son por metro", () => {
    expect(validateLength({ ...cable, saleUnit: "UNIT" }, 5).ok).toBe(false);
    expect(validateLength({ ...cable, saleUnit: "UNIT" }, null)).toEqual({ ok: true, length: null });
  });

  it("stock consumido en metros", () => {
    expect(stockRequired("METER", 3, 2.5)).toBe(7.5);
    expect(stockRequired("UNIT", 4, null)).toBe(4);
    expect(stockRequired("PACK", 2, null)).toBe(2);
  });
});

describe("venta por rollo/caja", () => {
  it("cobra por empaque y calcula precio de referencia por metro", () => {
    expect(linePrice("PACK", 98990, 2, null)).toBe(197980);
    expect(pricePerContentUnit(98990, 100)).toBe(990);
    expect(pricePerContentUnit(98990, null)).toBeNull();
  });
});

describe("kits", () => {
  const kit = [
    { saleUnit: "METER" as const, price: 690, quantity: 10, stock: 800 },
    { saleUnit: "METER" as const, price: 690, quantity: 10, stock: 25 },
    { saleUnit: "UNIT" as const, price: 2490, quantity: 1, stock: 120 },
    { saleUnit: "UNIT" as const, price: 1490, quantity: 1, stock: 200 },
  ];

  it("valor de componentes por separado", () => {
    expect(kitComponentsValue(kit)).toBe(6900 + 6900 + 2490 + 1490);
  });

  it("ahorro del kit", () => {
    expect(kitSavings(15000, kit)).toEqual({ componentsValue: 17780, amount: 2780, percent: 16 });
    expect(kitSavings(20000, kit).amount).toBe(0);
  });

  it("stock del kit = mínimo de kits armables por componente", () => {
    expect(kitAvailableStock(kit)).toBe(2); // 25 m / 10 m
    expect(kitAvailableStock([{ quantity: 3, stock: 9 }])).toBe(3);
    expect(kitAvailableStock([{ quantity: 0.5, stock: 1.5 }])).toBe(3);
    expect(kitAvailableStock([])).toBe(0);
  });

  it("descuento de stock por componente", () => {
    expect(kitStockRequired([{ variantId: "a", quantity: 10 }, { variantId: "b", quantity: 1 }], 3)).toEqual([
      { variantId: "a", amount: 30 },
      { variantId: "b", amount: 3 },
    ]);
  });
});
