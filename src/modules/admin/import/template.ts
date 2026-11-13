import ExcelJS from "exceljs";
import { IMPORT_FIELDS } from "./fields";

type Attr = { key: string; label: string; unit: string | null; type: string; options: string[] };

const EXAMPLES: Record<string, string>[] = [
  { sku: "THHN60-NG", nombre: "Cable THHN 6 mm²", variante: "Negro", categoria: "cable-unipolar", marca: "Conducta", descripcion_corta: "Conductor de cobre para alimentadores.", forma_venta: "metro", precio: "1490", stock: "500", largos: "5/10/25/50", medida_exacta: "si", largo_min: "1", largo_max: "100", largo_paso: "0,5", estado: "borrador", "attr:seccion_mm2": "6", "attr:voltaje": "600", "attr:material": "Cobre" },
  { sku: "THHN60-RJ", nombre: "Cable THHN 6 mm²", variante: "Rojo", forma_venta: "metro", precio: "1490", stock: "300" },
  { sku: "ENC20-IP65", nombre: "Enchufe industrial 16 A IP65", categoria: "enchufes", marca: "Volta", descripcion_corta: "Enchufe sobrepuesto para exterior.", forma_venta: "unidad", precio: "12990", stock: "25", estado: "publicado", imagenes: "https://ejemplo.cl/foto.jpg", "attr:amperaje": "16", "attr:voltaje": "250", "attr:ip": "IP65" },
];

export function templateColumns(attributes: Attr[]) {
  return [
    ...IMPORT_FIELDS.map((f) => ({ key: f.key, header: f.key, label: f.label, help: f.help + (f.required ? " (obligatorio)" : "") })),
    ...attributes.map((a) => ({
      key: `attr:${a.key}`,
      header: `attr:${a.key}`,
      label: `${a.label}${a.unit ? ` (${a.unit})` : ""}`,
      help: a.type === "SELECT" ? `Opciones: ${a.options.join(", ")}` : a.type === "NUMBER" ? "Número" : a.type === "BOOLEAN" ? "si / no" : "Texto",
    })),
  ];
}

export async function buildTemplateXlsx(attributes: Attr[]): Promise<Buffer> {
  const cols = templateColumns(attributes);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tienda";
  const ws = wb.addWorksheet("Productos", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, Math.min(28, c.header.length + 4)) }));
  ws.getRow(1).font = { bold: true };
  cols.forEach((c, i) => {
    ws.getCell(1, i + 1).note = `${c.label}. ${c.help}`;
  });
  for (const ex of EXAMPLES) ws.addRow(Object.fromEntries(cols.map((c) => [c.key, ex[c.key] ?? ""])));

  const help = wb.addWorksheet("Instrucciones");
  help.columns = [
    { header: "Columna", key: "col", width: 24 },
    { header: "Qué es", key: "label", width: 32 },
    { header: "Cómo llenarla", key: "help", width: 90 },
  ];
  help.getRow(1).font = { bold: true };
  help.addRow({ col: "", label: "", help: "Cada fila es una variante (SKU). Filas con el mismo nombre forman un producto con variantes." });
  help.addRow({ col: "", label: "", help: "Si el SKU ya existe en la tienda, la fila actualiza ese producto (las celdas vacías no cambian nada)." });
  help.addRow({ col: "", label: "", help: "Montos en pesos (12990 o 12.990). Decimales con coma o punto (2,5). Borra las filas de ejemplo antes de importar." });
  help.addRow({});
  for (const c of cols) help.addRow({ col: c.header, label: c.label, help: c.help });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildTemplateCsv(attributes: Attr[]): string {
  const cols = templateColumns(attributes);
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [cols.map((c) => esc(c.header)).join(";"), ...EXAMPLES.map((ex) => cols.map((c) => esc(ex[c.key] ?? "")).join(";"))];
  // BOM para que Excel abra bien los acentos
  return "﻿" + lines.join("\r\n") + "\r\n";
}
