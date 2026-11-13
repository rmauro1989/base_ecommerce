import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/modules/auth/admin";
import { deleteCategoryAction, saveCategoryAction } from "@/modules/admin/catalog/actions";
import { ActionForm, FormField } from "@/modules/admin/ui/action-form";
import { SubmitButton } from "@/modules/admin/ui/kit";
import { PageHeader, Panel } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Categorías" };

type Cat = { id: string; name: string; slug: string; parentId: string | null; position: number; description: string | null; _count: { products: number } };

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ editar?: string; nueva?: string; ok?: string; eliminada?: string }> }) {
  await connection();
  await requireAdmin();
  const sp = await searchParams;
  const [cats, attributes] = await Promise.all([
    db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } }),
    db.attributeDefinition.findMany({ orderBy: { position: "asc" } }),
  ]);
  const editing = sp.editar ? cats.find((c) => c.id === sp.editar) : undefined;
  const links = editing ? await db.categoryAttribute.findMany({ where: { categoryId: editing.id } }) : [];
  const showForm = Boolean(editing || sp.nueva !== undefined);

  // Árbol
  const children = (parent: string | null) => cats.filter((c) => c.parentId === parent);
  const flat: { cat: Cat; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => children(parent).forEach((c) => (flat.push({ cat: c, depth }), walk(c.id, depth + 1)));
  walk(null, 0);
  // Ancestros heredados (para mostrar atributos heredados)
  const inherited = new Set<string>();
  if (editing) {
    let p = editing.parentId;
    const ancestorIds: string[] = [];
    while (p) {
      ancestorIds.push(p);
      p = cats.find((c) => c.id === p)?.parentId ?? null;
    }
    (await db.categoryAttribute.findMany({ where: { categoryId: { in: ancestorIds } } })).forEach((l) => inherited.add(l.attributeId));
  }

  return (
    <>
      <PageHeader title="Categorías" description="Árbol de categorías y atributos técnicos sugeridos para cada una." actions={<ButtonLink href="/admin/categorias?nueva">Nueva categoría</ButtonLink>} />
      {sp.ok ? <p className="mb-4 rounded-md border border-success p-3 text-sm text-success">Categoría guardada.</p> : null}
      {sp.eliminada ? <p className="mb-4 rounded-md border border-success p-3 text-sm text-success">Categoría eliminada.</p> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Árbol">
          <ul className="flex flex-col">
            {flat.map(({ cat, depth }) => (
              <li key={cat.id}>
                <Link
                  href={`/admin/categorias?editar=${cat.id}`}
                  className={cn("flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary-soft", editing?.id === cat.id && "bg-primary-soft font-semibold")}
                  style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
                >
                  <span>
                    {depth > 0 ? <span className="text-muted">└ </span> : null}
                    {cat.name}
                  </span>
                  <span className="text-xs text-muted">{cat._count.products}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {showForm ? (
          <Panel title={editing ? `Editar: ${editing.name}` : "Nueva categoría"}>
            <ActionForm action={saveCategoryAction} key={editing?.id ?? "new"} className="flex flex-col gap-4">
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="name" label="Nombre">
                  <Input id="name" name="name" defaultValue={editing?.name} required />
                </FormField>
                <FormField name="slug" label="Slug (URL)" hint="Vacío = se genera del nombre">
                  <Input id="slug" name="slug" defaultValue={editing?.slug} />
                </FormField>
                <FormField name="parentId" label="Categoría padre">
                  <Select id="parentId" name="parentId" defaultValue={editing?.parentId ?? ""}>
                    <option value="">— Ninguna (principal) —</option>
                    {flat
                      .filter(({ cat }) => cat.id !== editing?.id)
                      .map(({ cat, depth }) => (
                        <option key={cat.id} value={cat.id}>
                          {"— ".repeat(depth)}
                          {cat.name}
                        </option>
                      ))}
                  </Select>
                </FormField>
                <FormField name="position" label="Orden">
                  <Input id="position" name="position" type="number" min={0} defaultValue={editing?.position ?? 0} />
                </FormField>
                <FormField name="description" label="Descripción" className="sm:col-span-2">
                  <Textarea id="description" name="description" defaultValue={editing?.description ?? ""} rows={2} />
                </FormField>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Atributos técnicos de esta categoría</p>
                <p className="mb-3 text-xs text-muted">Se sugieren al crear productos. Las subcategorías los heredan. Los obligatorios se exigen para publicar.</p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg text-left text-xs text-muted">
                        <th className="px-3 py-2 font-medium">Atributo</th>
                        <th className="px-3 py-2 font-medium">Usar</th>
                        <th className="px-3 py-2 font-medium">Obligatorio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attributes.map((a) => {
                        const link = links.find((l) => l.attributeId === a.id);
                        return (
                          <tr key={a.id} className="border-t border-border">
                            <td className="px-3 py-1.5">
                              {a.label}
                              {a.unit ? <span className="text-muted"> ({a.unit})</span> : null}
                              {inherited.has(a.id) ? (
                                <Badge tone="soft" className="ml-2">
                                  heredado
                                </Badge>
                              ) : null}
                            </td>
                            <td className="px-3 py-1.5">
                              <input type="checkbox" name="attrs" value={a.id} defaultChecked={!!link} aria-label={`Usar ${a.label}`} />
                            </td>
                            <td className="px-3 py-1.5">
                              <input type="checkbox" name="required" value={a.id} defaultChecked={!!link?.required} aria-label={`${a.label} obligatorio`} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex gap-2">
                <SubmitButton>{editing ? "Guardar" : "Crear categoría"}</SubmitButton>
                <ButtonLink href="/admin/categorias" variant="ghost">
                  Cancelar
                </ButtonLink>
              </div>
            </ActionForm>
            {editing ? (
              <ActionForm action={deleteCategoryAction} confirm={`¿Eliminar la categoría "${editing.name}"?`} className="mt-6 border-t border-border pt-4">
                <input type="hidden" name="id" value={editing.id} />
                <SubmitButton variant="ghost" pendingLabel="Eliminando…">
                  Eliminar categoría
                </SubmitButton>
              </ActionForm>
            ) : null}
          </Panel>
        ) : (
          <Panel>
            <p className="text-sm text-muted">Elige una categoría del árbol para editarla o crea una nueva.</p>
          </Panel>
        )}
      </div>
    </>
  );
}
