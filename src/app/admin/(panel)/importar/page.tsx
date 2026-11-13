import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { uploadImportAction } from "@/modules/admin/import/actions";
import { MAX_ROWS } from "@/modules/admin/import/parse";
import { ActionForm } from "@/modules/admin/ui/action-form";
import { SubmitButton } from "@/modules/admin/ui/kit";
import { PageHeader, Panel, tableClasses as t } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Carga masiva" };

const STATUS = { PREVIEW: ["Sin confirmar", "accent"], COMMITTED: ["Importado", "success"], FAILED: ["Falló", "danger"] } as const;

export default async function ImportPage() {
  await connection();
  await requireAdmin();
  const jobs = await db.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 15, select: { id: true, fileName: true, status: true, createdAt: true } });
  return (
    <>
      <PageHeader title="Carga masiva" description="Crea o actualiza muchos productos desde Excel o CSV." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="1. Descarga la plantilla" description="Incluye ejemplos, instrucciones y una columna por cada atributo técnico de tu tienda.">
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/plantilla-importacion?formato=xlsx" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover">
              Plantilla Excel (.xlsx)
            </a>
            <a href="/api/admin/plantilla-importacion?formato=csv" className="inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-primary-soft">
              Plantilla CSV
            </a>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Cada fila es una variante (un SKU). Filas con el mismo nombre forman un producto.</li>
            <li>Si el SKU ya existe, la fila actualiza ese producto; las celdas vacías no cambian nada.</li>
            <li>Máximo {MAX_ROWS} filas y 5 MB por archivo.</li>
          </ul>
        </Panel>
        <Panel title="2. Sube tu archivo" description="Luego podrás revisar el mapeo de columnas y una vista previa antes de confirmar.">
          <ActionForm action={uploadImportAction} className="flex flex-col gap-3">
            <input
              type="file"
              name="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              aria-label="Archivo de productos"
              className="rounded-md border border-dashed border-border-strong bg-bg p-4 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-on-primary"
            />
            <div>
              <SubmitButton pendingLabel="Leyendo archivo…">Subir y continuar</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
      {jobs.length ? (
        <Panel title="Importaciones recientes" className="mt-6">
          <div className={t.wrap}>
            <table className={t.table}>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className={t.td}>
                      <Link href={`/admin/importar/${j.id}`} className="font-semibold hover:underline">
                        {j.fileName}
                      </Link>
                    </td>
                    <td className={t.td}>{j.createdAt.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" })}</td>
                    <td className={t.td}>
                      <Badge tone={STATUS[j.status][1]}>{STATUS[j.status][0]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </>
  );
}
