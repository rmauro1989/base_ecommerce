import { describe, expect, it } from "vitest";
import { findZoneForComuna, normalizeComuna, shippingCost } from "@/modules/checkout/shipping";

const zones = [
  { id: "a", name: "Centro", comunas: ["Ñuñoa", "Providencia"], price: 3990, freeShippingOver: 60000, estimatedDays: null, isFallback: false, active: true },
  { id: "b", name: "Inactiva", comunas: ["Maipú"], price: 1, freeShippingOver: null, estimatedDays: null, isFallback: false, active: false },
  { id: "c", name: "Resto", comunas: [], price: 9990, freeShippingOver: null, estimatedDays: null, isFallback: true, active: true },
];

describe("despacho", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(normalizeComuna("  ÑUÑOA ")).toBe("nunoa");
    expect(normalizeComuna("Estación   Central")).toBe("estacion central");
  });

  it("encuentra la zona de la comuna o usa la zona por defecto", () => {
    expect(findZoneForComuna(zones, "nunoa")?.id).toBe("a");
    expect(findZoneForComuna(zones, "Maipú")?.id).toBe("c"); // la zona de Maipú está inactiva
    expect(findZoneForComuna(zones, "Arica")?.id).toBe("c");
    expect(findZoneForComuna(zones, "")).toBeNull();
    expect(findZoneForComuna(zones.slice(0, 2), "Arica")).toBeNull();
  });

  it("aplica despacho gratis sobre el monto mínimo", () => {
    expect(shippingCost(zones[0], 59999)).toBe(3990);
    expect(shippingCost(zones[0], 60000)).toBe(0);
    expect(shippingCost(zones[2], 500000)).toBe(9990);
  });
});
