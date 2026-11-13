import { afterAll, beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { seedDatabase } from "../../prisma/seed-lib";
import { db } from "@/lib/db";
import { commitImportPlan } from "@/modules/admin/import/commit";
import { autoMap } from "@/modules/admin/import/fields";
import { parseImportFile } from "@/modules/admin/import/parse";
import { loadImportContext, skusFromJob } from "@/modules/admin/import/service";
import { buildTemplateXlsx } from "@/modules/admin/import/template";
import { buildImportPlan } from "@/modules/admin/import/validate";
import { truncateAll } from "../helpers/db";

async function planFrom(buf: Uint8Array, name: string) {
  const table = await parseImportFile(buf, name);
  const attrs = await db.attributeDefinition.findMany();
  const mapping = autoMap(table.headers, attrs);
  const ctx = await loadImportContext(skusFromJob(table, mapping));
  return buildImportPlan(table.headers, table.rows, mapping, ctx);
}

describe("carga masiva (integración)", () => {
  beforeEach(async () => {
    await truncateAll(db);
    await seedDatabase(db, () => {});
  });
  afterAll(() => db.$disconnect());

  it("la plantilla Excel se puede importar tal cual (ejemplos válidos)", async () => {
    const attrs = await db.attributeDefinition.findMany({ orderBy: { position: "asc" } });
    const xlsx = await buildTemplateXlsx(attrs);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength) as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Productos", "Instrucciones"]);

    // La URL de ejemplo no se descarga en el test: se quita
    const ws = wb.getWorksheet("Productos")!;
    const imgCol = (ws.getRow(1).values as string[]).indexOf("imagenes");
    ws.eachRow((r, i) => i > 1 && (r.getCell(imgCol).value = null));
    const clean = new Uint8Array(await wb.xlsx.writeBuffer());

    const plan = await planFrom(clean, "plantilla.xlsx");
    expect(plan.summary.errors).toBe(0);
    expect(plan.summary.create).toBe(2); // cable (2 variantes) + enchufe
    const res = await commitImportPlan(plan, { allowPublish: true });
    expect(res).toMatchObject({ created: 2, updated: 0, failed: [] });
    expect(res.drafts).toContain("Enchufe industrial 16 A IP65"); // sin foto → borrador
    const cable = await db.product.findUniqueOrThrow({ where: { slug: "cable-thhn-6-mm2" }, include: { variants: true, attributes: true } });
    expect(cable.saleUnit).toBe("METER");
    expect(cable.variants.map((v) => v.sku).sort()).toEqual(["THHN60-NG", "THHN60-RJ"]);
    expect(Number(cable.lengthStep)).toBe(0.5);
    expect(cable.attributes).toHaveLength(3);
    expect(cable.status).toBe("DRAFT");
  });

  it("actualiza stock y precio por SKU existente sin tocar lo demás, y publica si cumple el checklist", async () => {
    const before = await db.product.findUniqueOrThrow({ where: { slug: "enchufe-doble-10a" }, include: { images: true } });
    await db.product.update({ where: { id: before.id }, data: { status: "DRAFT" } });
    const csv = Buffer.from("sku;precio;stock;estado\nENC10D-BL;2.790;45;publicado\nENC10D-NEW;;10;\n");
    // La segunda fila es un SKU nuevo sin nombre → error
    const plan = await planFrom(csv, "stock.csv");
    expect(plan.rows[1].errors.join()).toMatch(/Falta el nombre/);
    const res = await commitImportPlan(plan, { allowPublish: true });
    expect(res).toMatchObject({ updated: 1, created: 0, published: 1 });
    const after = await db.product.findUniqueOrThrow({ where: { id: before.id }, include: { variants: true, images: true } });
    expect(after.price).toBe(2790);
    expect(after.status).toBe("PUBLISHED");
    expect(after.name).toBe(before.name);
    expect(after.images).toHaveLength(before.images.length);
    expect(Number(after.variants.find((v) => v.sku === "ENC10D-BL")!.stock)).toBe(45);
    expect(Number(after.variants.find((v) => v.sku === "ENC10D-GR")!.stock)).toBe(60);
  });

  it("sin permiso de publicar todo queda en borrador", async () => {
    const csv = Buffer.from("sku;precio;estado\nDIS1P16C;5490;publicado\n");
    await db.product.updateMany({ where: { slug: "disyuntor-1p-16a-curva-c" }, data: { status: "DRAFT" } });
    const res = await commitImportPlan(await planFrom(csv, "a.csv"), { allowPublish: false });
    expect(res.drafts).toEqual(["Disyuntor 1P 16 A curva C"]);
    expect((await db.product.findUniqueOrThrow({ where: { slug: "disyuntor-1p-16a-curva-c" } })).status).toBe("DRAFT");
  });
});
