import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { commitImportAction, saveMappingAction } from "@/modules/admin/import/actions";
import type { CommitSummary } from "@/modules/admin/import/commit";
import { IGNORE, IMPORT_FIELDS } from "@/modules/admin/import/fields";
import { loadImportContext, skusFromJob, type JobData } from "@/modules/admin/import/service";
import { buildImportPlan } from "@/modules/admin/import/validate";
import { ActionForm } from "@/modules/admin/ui/action-form";
import { SubmitButton } from "@/modules/admin/ui/kit";
import { PageHeader, Panel, tableClasses as t } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Carga masiva" };

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Mapear columnas", "Revisar", "Resultado"];
  return (
    <ol className="mb-6 flex flex-wrap gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s} className={cn("rounded-full px-3 py-1", i + 1 === current ? "bg-primary text-on-primary" : i + 1 < current ? "bg-primary-soft" : "border border-border text-muted")}>
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  );
}

export default async function ImportJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paso?: string }> }) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  const job = await db.importJob.findUnique({ where: { id } });
  if (!job) notFound();
  const data = job.rows as unknown as JobData;
  const mapping = job.mapping as Record<string, string>;
  const step = (await searchParams).paso;
  const back = (
    <Link href="/admin/importar" className="underline">
      ← Carga masiva
    </Link>
  );

  // ── Resultado ──
  if (job.status !== "PREVIEW") {
    const s = (job.summary ?? {}) as Partial<CommitSummary> & { skippedRows?: number; error?: string };
    return (
      <>
        <PageHeader title={job.fileName} description={back} />
        <Steps current={3} />
        {job.status === "FAILED" ? (
          <Panel title="La importación falló">
            <p className="text-sm text-danger">{s.error ?? "Error desconocido."}</p>
          </Panel>
        ) : (
          <Panel title="Importación completada">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Productos creados", s.created ?? 0],
                ["Productos actualizados", s.updated ?? 0],
                ["Publicados", s.published ?? 0],
                ["Filas omitidas", s.skippedRows ?? 0],
              ].map(([label, v]) => (
                <div key={label} className="rounded-md bg-bg p-3">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="font-display text-2xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            {s.drafts?.length ? <p className="mt-4 text-sm">Quedaron en borrador (checklist incompleto): {s.drafts.join(", ")}.</p> : null}
            {s.failed?.length ? (
              <ul className="mt-4 text-sm text-danger">
                {s.failed.map((f) => (
                  <li key={f.name}>
                    {f.name}: {f.error}
                  </li>
                ))}
              </ul>
            ) : null}
            {s.imageErrors?.length ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer">Imágenes que no se pudieron descargar ({s.imageErrors.length})</summary>
                <ul className="mt-2 list-disc pl-5 text-muted">
                  {s.imageErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="mt-5 flex gap-2">
              <ButtonLink href="/admin/productos">Ver productos</ButtonLink>
              <ButtonLink href="/admin/importar" variant="outline">
                Nueva importación
              </ButtonLink>
            </div>
          </Panel>
        )}
      </>
    );
  }

  const attributes = await db.attributeDefinition.findMany({ orderBy: { position: "asc" } });

  // ── Paso 1: mapeo ──
  if (step !== "revisar") {
    return (
      <>
        <PageHeader title={job.fileName} description={<>{back} · {data.rows.length} fila(s)</>} />
        <Steps current={1} />
        <Panel title="¿Qué contiene cada columna?" description="Detectamos automáticamente las columnas conocidas. Revisa y ajusta si hace falta. SKU, Nombre y Precio son obligatorios.">
          <ActionForm action={saveMappingAction}>
            <input type="hidden" name="jobId" value={job.id} />
            <div className={t.wrap}>
              <table className={t.table}>
                <thead>
                  <tr>
                    <th className={t.th}>Columna del archivo</th>
                    <th className={t.th}>Ejemplos</th>
                    <th className={t.th}>Importar como</th>
                  </tr>
                </thead>
                <tbody>
                  {data.headers.map((h, i) => (
                    <tr key={h}>
                      <td className={`${t.td} font-semibold`}>{h}</td>
                      <td className={`${t.td} max-w-xs truncate text-xs text-muted`}>
                        {data.rows
                          .slice(0, 3)
                          .map((r) => r[i])
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className={t.td}>
                        <Select name={`map_${i}`} defaultValue={mapping[h] ?? IGNORE} aria-label={`Campo para ${h}`} className="w-64">
                          <option value={IGNORE}>— No importar —</option>
                          <optgroup label="Producto">
                            {IMPORT_FIELDS.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                                {f.required ? " *" : ""}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Ficha técnica">
                            {attributes.map((a) => (
                              <option key={a.key} value={`attr:${a.key}`}>
                                {a.label}
                                {a.unit ? ` (${a.unit})` : ""}
                              </option>
                            ))}
                          </optgroup>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <SubmitButton pendingLabel="Validando…">Continuar a la vista previa</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </>
    );
  }

  // ── Paso 2: vista previa ──
  const ctx = await loadImportContext(skusFromJob(data, mapping));
  const plan = buildImportPlan(data.headers, data.rows, mapping, ctx, { overflowRows: data.overflowRows });
  const s = plan.summary;
  return (
    <>
      <PageHeader title={job.fileName} description={back} />
      <Steps current={2} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Productos nuevos", s.create, ""],
          ["Productos a actualizar", s.update, ""],
          ["Filas con errores (se omiten)", s.skippedRows, s.skippedRows ? "text-danger" : ""],
          ["Advertencias", s.warnings, ""],
        ].map(([label, v, cls]) => (
          <div key={label as string} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className={cn("font-display text-2xl font-bold", cls as string)}>{v}</p>
          </div>
        ))}
      </div>

      <div className={t.wrap}>
        <table className={t.table}>
          <thead>
            <tr>
              <th className={t.th}>Fila</th>
              <th className={t.th}>SKU</th>
              <th className={t.th}>Producto</th>
              <th className={t.th}>Acción</th>
              <th className={t.th}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.row} className={r.errors.length ? "bg-accent-soft" : ""}>
                <td className={`${t.td} font-mono text-xs`}>{r.row}</td>
                <td className={`${t.td} font-mono text-xs`}>{r.sku || "—"}</td>
                <td className={t.td}>{r.name || "—"}</td>
                <td className={t.td}>
                  {r.action === "skip" ? <Badge tone="danger">Se omite</Badge> : r.action === "update" ? <Badge tone="primary">Actualizar</Badge> : <Badge tone="success">Crear</Badge>}
                </td>
                <td className={`${t.td} text-xs`}>
                  {r.errors.map((e) => (
                    <p key={e} className="text-danger">
                      ✗ {e}
                    </p>
                  ))}
                  {r.warnings.map((w) => (
                    <p key={w} className="text-muted">
                      ⚠ {w}
                    </p>
                  ))}
                  {!r.errors.length && !r.warnings.length ? <span className="text-success">✓ OK</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Panel title="Confirmar importación" className="mt-6">
        {plan.products.length ? (
          <ActionForm action={commitImportAction} className="flex flex-col gap-3" confirm={`¿Importar ${s.create} producto(s) nuevo(s) y actualizar ${s.update}?`}>
            <input type="hidden" name="jobId" value={job.id} />
            <p className="text-sm">
              Se crearán <strong>{s.create}</strong> producto(s) y se actualizarán <strong>{s.update}</strong>.
              {s.skippedRows ? ` ${s.skippedRows} fila(s) con errores no se importarán.` : ""}
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="allowPublish" defaultChecked className="mt-1" />
              Publicar los productos marcados como “publicado” que cumplan el checklist (el resto queda en borrador).
            </label>
            <div className="flex gap-2">
              <SubmitButton pendingLabel="Importando…">Confirmar e importar</SubmitButton>
              <ButtonLink href={`/admin/importar/${job.id}`} variant="ghost">
                Volver al mapeo
              </ButtonLink>
            </div>
          </ActionForm>
        ) : (
          <p className="text-sm text-danger">
            No hay productos válidos. Corrige el archivo y súbelo nuevamente, o{" "}
            <Link href={`/admin/importar/${job.id}`} className="underline">
              revisa el mapeo
            </Link>
            .
          </p>
        )}
      </Panel>
    </>
  );
}
