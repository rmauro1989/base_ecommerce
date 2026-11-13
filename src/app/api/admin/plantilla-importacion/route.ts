import { db } from "@/lib/db";
import { getAdminSession } from "@/modules/auth/admin";
import { buildTemplateCsv, buildTemplateXlsx } from "@/modules/admin/import/template";

/** Plantilla de carga masiva con los atributos técnicos actuales de la tienda. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return new Response("No autorizado", { status: 401 });
  const format = new URL(req.url).searchParams.get("formato") === "csv" ? "csv" : "xlsx";
  const attributes = await db.attributeDefinition.findMany({ orderBy: { position: "asc" } });
  if (format === "csv") {
    return new Response(buildTemplateCsv(attributes), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="plantilla-productos.csv"', "Cache-Control": "no-store" },
    });
  }
  const buf = await buildTemplateXlsx(attributes);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-productos.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
