import { describe, expect, it } from "vitest";
import { autoMap, IGNORE, parseDecimal, parseMoney, parseSaleUnit } from "@/modules/admin/import/fields";
import { decodeCsv, parseImportFile } from "@/modules/admin/import/parse";
import { buildImportPlan, missingRequiredMappings, type ImportContext } from "@/modules/admin/import/validate";
import { isPrivateAddress } from "@/modules/media/remote";

const ctx: ImportContext = {
  categories: [
    { id: "c-cab", slug: "cable-unipolar", name: "Cable unipolar" },
    { id: "c-enc", slug: "enchufes", name: "Enchufes" },
  ],
  categoryFields: {
    "c-cab": [{ id: "a-sec", label: "Sección", type: "NUMBER", options: [], required: true }],
    "c-enc": [
      { id: "a-amp", label: "Amperaje", type: "NUMBER", options: [], required: true },
      { id: "a-ip", label: "Grado IP", type: "SELECT", options: ["IP20", "IP44", "IP65"], required: false },
    ],
  },
  attributes: [
    { id: "a-sec", key: "seccion_mm2", label: "Sección", type: "NUMBER", options: [] },
    { id: "a-amp", key: "amperaje", label: "Amperaje", type: "NUMBER", options: [] },
    { id: "a-ip", key: "ip", label: "Grado IP", type: "SELECT", options: ["IP20", "IP44", "IP65"] },
  ],
  existingSkus: { "ENC10D-BL": { productId: "p-enc", variantId: "v-enc", productName: "Enchufe doble", categoryId: "c-enc", saleUnit: "UNIT" } },
  existingSlugs: ["cable-thhn-6-mm2"],
};

const headers = ["SKU", "Nombre", "Variante", "Categoría", "Forma de venta", "Precio", "Stock", "Largos", "Medida exacta", "attr:seccion_mm2", "Amperaje", "IP", "Estado", "Notas internas"];
const mapping = autoMap(headers, ctx.attributes);

describe("lectura de valores", () => {
  it("montos y decimales en formato chileno", () => {
    expect(parseMoney("$12.990")).toBe(12990);
    expect(parseMoney("12990")).toBe(12990);
    expect(parseMoney("1.234.567")).toBe(1234567);
    expect(parseMoney("12990.0")).toBe(12990);
    expect(parseMoney("abc")).toBeNaN();
    expect(parseDecimal("2,5")).toBe(2.5);
    expect(parseDecimal("2.5")).toBe(2.5);
    expect(parseDecimal("1.000")).toBe(1000);
    expect(parseDecimal("1.000,5")).toBe(1000.5);
    expect(parseSaleUnit("Metros")).toBe("METER");
    expect(parseSaleUnit("Rollo")).toBe("PACK");
    expect(parseSaleUnit("kilo")).toBe("invalid");
  });
});

describe("mapeo automático", () => {
  it("reconoce encabezados en español, con tildes y atributos; ignora desconocidos", () => {
    expect(mapping).toEqual({
      SKU: "sku",
      Nombre: "nombre",
      Variante: "variante",
      Categoría: "categoria",
      "Forma de venta": "forma_venta",
      Precio: "precio",
      Stock: "stock",
      Largos: "largos",
      "Medida exacta": "medida_exacta",
      "attr:seccion_mm2": "attr:seccion_mm2",
      Amperaje: "attr:amperaje",
      IP: "attr:ip",
      Estado: "estado",
      "Notas internas": IGNORE,
    });
    expect(missingRequiredMappings(mapping)).toEqual([]);
    expect(missingRequiredMappings({ A: "sku" })).toEqual(["nombre", "precio"]);
  });
});

const row = (o: Partial<Record<string, string>>) => headers.map((h) => o[h] ?? "");

describe("validación del plan", () => {
  it("agrupa variantes por nombre, actualiza SKUs existentes y genera slug único", () => {
    const plan = buildImportPlan(
      headers,
      [
        row({ SKU: "thhn60-ng", Nombre: "Cable THHN 6 mm²", Variante: "Negro", Categoría: "Cable unipolar", "Forma de venta": "metro", Precio: "1.490", Stock: "500", Largos: "10/5 25", "attr:seccion_mm2": "6", Estado: "publicado" }),
        row({ SKU: "THHN60-RJ", Nombre: "Cable THHN 6 mm²", Variante: "Rojo", Precio: "1490", Stock: "300,5" }),
        row({ SKU: "ENC10D-BL", Stock: "99", Precio: "2590" }),
      ],
      mapping,
      ctx,
    );
    expect(plan.summary).toMatchObject({ create: 1, update: 1, skippedRows: 0 });
    const cable = plan.products.find((p) => !p.existingProductId)!;
    expect(cable.slug).toBe("cable-thhn-6-mm2-2");
    expect(cable.saleUnit).toBe("METER");
    expect(cable.lengthPresets).toEqual([5, 10, 25]);
    expect(cable.variants.map((v) => [v.sku, v.name, v.stock])).toEqual([
      ["THHN60-NG", "Negro", 500],
      ["THHN60-RJ", "Rojo", 300.5],
    ]);
    expect(cable.attributes).toEqual([{ attributeId: "a-sec", valueNumber: 6 }]);
    // publicado sin foto → advertencia de borrador
    expect(plan.rows[0].warnings.join(" ")).toMatch(/Quedará en borrador \(falta: foto\)/);
    const enc = plan.products.find((p) => p.existingProductId === "p-enc")!;
    expect(enc.variants[0]).toMatchObject({ sku: "ENC10D-BL", stock: 99, existingVariantId: "v-enc" });
    expect(enc.price).toBe(2590);
  });

  it("reporta errores por fila y omite el producto completo", () => {
    const plan = buildImportPlan(
      headers,
      [
        row({ SKU: "A1", Nombre: "Enchufe X", Categoría: "enchufes", Precio: "abc", Amperaje: "diez", IP: "IP99" }),
        row({ SKU: "A2", Nombre: "Enchufe X", Precio: "1000" }),
        row({ SKU: "", Nombre: "Sin sku", Precio: "1000" }),
        row({ SKU: "B1", Nombre: "Cable sin largos", "Forma de venta": "metro", Precio: "500" }),
        row({ SKU: "C1", Nombre: "Cosa", Precio: "500", Categoría: "no-existe", "Forma de venta": "kilo", Estado: "tal vez" }),
        row({ SKU: "C1", Nombre: "Otra cosa", Precio: "500" }),
      ],
      mapping,
      ctx,
    );
    const errs = (n: number) => plan.rows.find((r) => r.row === n)!.errors.join(" | ");
    expect(errs(2)).toMatch(/Precio inválido/);
    expect(errs(2)).toMatch(/Amperaje: "diez" no es un número/);
    expect(errs(2)).toMatch(/Grado IP: "IP99" no está en la lista/);
    expect(errs(3)).toMatch(/otra fila del mismo producto/);
    expect(errs(4)).toMatch(/Falta el SKU/);
    expect(errs(5)).toMatch(/sin largos ni medida exacta/);
    expect(errs(6)).toMatch(/Categoría no encontrada/);
    expect(errs(6)).toMatch(/Forma de venta desconocida/);
    expect(errs(6)).toMatch(/Estado desconocido/);
    expect(errs(7)).toMatch(/SKU repetido en el archivo \(también en la fila 6\)/);
    expect(plan.products).toHaveLength(0);
    expect(plan.rows.every((r) => r.action === "skip")).toBe(true);
  });

  it("ignora atributos que no aplican a la categoría con advertencia", () => {
    const plan = buildImportPlan(headers, [row({ SKU: "Z1", Nombre: "Cable Z", Categoría: "cable-unipolar", "Forma de venta": "metro", "Medida exacta": "si", Precio: "100", Amperaje: "10" })], mapping, ctx);
    expect(plan.rows[0].errors).toEqual([]);
    expect(plan.rows[0].warnings.join(" ")).toMatch(/"Amperaje" no aplica a la categoría/);
    expect(plan.products[0].attributes).toEqual([]);
  });
});

describe("lectura de archivos", () => {
  it("CSV con ; y codificación Windows-1252 (Excel en español)", async () => {
    // "Categoría;Cañería" en latin1
    const latin1 = new Uint8Array([...Buffer.from("SKU;Nombre;Categor"), 0xed, 0x61, ...Buffer.from(";Precio\nX1;Ca"), 0xf1, ...Buffer.from("o;enchufes;1.990\n")]);
    expect(decodeCsv(latin1)).toContain("Categoría");
    const t = await parseImportFile(latin1, "productos.csv");
    expect(t.headers).toEqual(["SKU", "Nombre", "Categoría", "Precio"]);
    expect(t.rows).toEqual([["X1", "Caño", "enchufes", "1.990"]]);
  });

  it("detecta filas con columnas de más (separador mal usado)", async () => {
    const t = await parseImportFile(Buffer.from("sku;nombre;largos;precio\nA;Cable;5;10;20;990\nB;Otro;5/10;990\n"), "x.csv");
    expect(t.overflowRows).toEqual([2]);
    const m = autoMap(t.headers, []);
    const plan = buildImportPlan(t.headers, t.rows, m, ctx, { overflowRows: t.overflowRows });
    expect(plan.rows[0].errors.join()).toMatch(/más columnas que el encabezado/);
  });

  it("rechaza archivos vacíos y formatos no soportados", async () => {
    await expect(parseImportFile(Buffer.from("SKU;Nombre\n"), "a.csv")).rejects.toThrow(/no tiene filas/);
    await expect(parseImportFile(Buffer.from("x"), "a.pdf")).rejects.toThrow(/Formato no soportado/);
  });
});

describe("protección SSRF para imágenes", () => {
  it("bloquea IPs privadas y locales", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "200.1.2.3", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});
