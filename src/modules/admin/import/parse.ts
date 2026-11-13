import ExcelJS from "exceljs";
import Papa from "papaparse";

export const MAX_ROWS = 2000;
export const MAX_COLS = 80;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class ImportParseError extends Error {}

/** overflowRows: filas (n° de fila del archivo) con más columnas que el encabezado */
export type ParsedTable = { headers: string[]; rows: string[][]; overflowRows?: number[] };

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "si" : "no";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim();
    if ("hyperlink" in value) return String(value.hyperlink ?? value.text ?? "").trim();
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim();
    if ("error" in value) return "";
  }
  return String(value).trim();
}

/** Decodifica CSV en UTF-8; si trae caracteres inválidos, prueba Windows-1252 (Excel en español). */
export function decodeCsv(buf: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  const text = utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
  return text.replace(/^﻿/, "");
}

function finalize(table: string[][]): ParsedTable {
  const nonEmpty = table.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length < 2) throw new ImportParseError("El archivo no tiene filas de datos (la primera fila debe ser el encabezado).");
  const [rawHeaders, ...rows] = nonEmpty;
  if (rawHeaders.length > MAX_COLS) throw new ImportParseError(`Demasiadas columnas (máximo ${MAX_COLS}).`);
  if (rows.length > MAX_ROWS) throw new ImportParseError(`Demasiadas filas (${rows.length}). El máximo por archivo es ${MAX_ROWS}.`);
  // Encabezados únicos y no vacíos
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    const base = h.trim() || `Columna ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  const overflowRows = rows.flatMap((r, i) => (r.slice(headers.length).some((c) => c.trim() !== "") ? [i + 2] : []));
  return { headers, rows: rows.map((r) => headers.map((_, i) => (r[i] ?? "").trim())), overflowRows };
}

export async function parseImportFile(data: Uint8Array, fileName: string): Promise<ParsedTable> {
  if (data.byteLength > MAX_FILE_BYTES) throw new ImportParseError("El archivo supera 5 MB.");
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "xlsx") {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    } catch {
      throw new ImportParseError("No pudimos leer el Excel. Guárdalo como .xlsx e inténtalo nuevamente.");
    }
    const ws = wb.getWorksheet("Productos") ?? wb.worksheets.find((w) => w.state === "visible") ?? wb.worksheets[0];
    if (!ws) throw new ImportParseError("El Excel no tiene hojas.");
    const table: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values: string[] = [];
      const count = Math.min(row.cellCount, MAX_COLS + 1);
      for (let c = 1; c <= count; c++) values.push(cellToString(row.getCell(c).value));
      table.push(values);
    });
    return finalize(table);
  }
  if (ext === "csv" || ext === "txt") {
    const text = decodeCsv(data);
    const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy", delimitersToGuess: [";", ",", "\t", "|"] });
    if (res.errors.length && !res.data.length) throw new ImportParseError("No pudimos leer el CSV.");
    return finalize(res.data.map((r) => r.map((c) => String(c ?? ""))));
  }
  throw new ImportParseError("Formato no soportado. Usa .xlsx o .csv.");
}
