import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { deleteAttributeAction, saveAttributeAction } from "@/modules/admin/catalog/actions";
import { ActionForm, FormField } from "@/modules/admin/ui/action-form";
import { SubmitButton } from "@/modules/admin/ui/kit";
import { PageHeader, Panel, tableClasses as t } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Atributos técnicos" };

const TYPE_LABEL = { NUMBER: "Número", TEXT: "Texto", SELECT: "Lista de opciones", BOOLEAN: "Sí / No" } as const;

export default async function AttributesPage({ searchParams }: { searchParams: Promise<{ editar?: string; nuevo?: string; ok?: string }> }) {
  await connection();
  await requireAdmin();
  const sp = await searchParams;
  const attrs = await db.attributeDefinition.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { values: true, categories: true } } } });
  const editing = sp.editar ? attrs.find((a) => a.id === sp.editar) : undefined;
  const showForm = Boolean(editing || sp.nuevo !== undefined);

  return (
    <>
      <PageHeader
        title="Atributos técnicos"
        description="Datos de la ficha técnica (sección, amperaje, voltaje, IP…). Se asignan a categorías y se usan como filtros."
        actions={<ButtonLink href="/admin/atributos?nuevo">Nuevo atributo</ButtonLink>}
      />
      {sp.ok ? <p className="mb-4 rounded-md border border-success p-3 text-sm text-success">Atributo guardado.</p> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className={t.wrap}>
          <table className={t.table}>
            <thead>
              <tr>
                <th className={t.th}>Atributo</th>
                <th className={t.th}>Clave</th>
                <th className={t.th}>Tipo</th>
                <th className={t.th}>Filtro</th>
                <th className={`${t.th} text-right`}>Productos</th>
              </tr>
            </thead>
            <tbody>
              {attrs.map((a) => (
                <tr key={a.id} className={editing?.id === a.id ? "bg-primary-soft" : ""}>
                  <td className={t.td}>
                    <Link href={`/admin/atributos?editar=${a.id}`} className="font-semibold hover:underline">
                      {a.label}
                    </Link>
                    {a.unit ? <span className="text-muted"> ({a.unit})</span> : null}
                  </td>
                  <td className={`${t.td} font-mono text-xs`}>{a.key}</td>
                  <td className={t.td}>{TYPE_LABEL[a.type]}</td>
                  <td className={t.td}>{a.filterable ? "Sí" : "No"}</td>
                  <td className={`${t.td} text-right`}>{a._count.values}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showForm ? (
          <Panel title={editing ? `Editar: ${editing.label}` : "Nuevo atributo"}>
            <ActionForm action={saveAttributeAction} key={editing?.id ?? "new"} className="flex flex-col gap-4">
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <FormField name="label" label="Nombre visible">
                <Input id="label" name="label" defaultValue={editing?.label} placeholder="Ej: Amperaje" required />
              </FormField>
              <FormField name="key" label="Clave" hint="Se usa en la URL de filtros y en la carga masiva. Ej: amperaje">
                <Input id="key" name="key" defaultValue={editing?.key} className="font-mono" required />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField name="type" label="Tipo">
                  <Select id="type" name="type" defaultValue={editing?.type ?? "NUMBER"}>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="unit" label="Unidad">
                  <Input id="unit" name="unit" defaultValue={editing?.unit ?? ""} placeholder="A, V, mm²…" />
                </FormField>
              </div>
              <FormField name="options" label="Opciones (solo para lista)" hint="Una por línea o separadas por coma.">
                <Textarea id="options" name="options" defaultValue={editing?.options.join("\n")} rows={3} />
              </FormField>
              <div className="grid grid-cols-2 items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="filterable" defaultChecked={editing?.filterable ?? true} /> Usar como filtro en el catálogo
                </label>
                <FormField name="position" label="Orden">
                  <Input id="position" name="position" type="number" min={0} defaultValue={editing?.position ?? attrs.length} />
                </FormField>
              </div>
              <div className="flex gap-2">
                <SubmitButton>{editing ? "Guardar" : "Crear atributo"}</SubmitButton>
                <ButtonLink href="/admin/atributos" variant="ghost">
                  Cancelar
                </ButtonLink>
              </div>
            </ActionForm>
            {editing ? (
              <ActionForm action={deleteAttributeAction} confirm={`¿Eliminar el atributo "${editing.label}"?`} className="mt-6 border-t border-border pt-4">
                <input type="hidden" name="id" value={editing.id} />
                <SubmitButton variant="ghost" pendingLabel="Eliminando…">
                  Eliminar atributo
                </SubmitButton>
              </ActionForm>
            ) : null}
          </Panel>
        ) : null}
      </div>
    </>
  );
}
