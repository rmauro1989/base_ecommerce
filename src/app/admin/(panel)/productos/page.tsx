import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { requireAdmin } from "@/modules/auth/admin";
import { ProductTable } from "@/modules/admin/products/components/product-table";
import { getProductFormOptions, listAdminProducts } from "@/modules/admin/products/service";
import { EmptyState, PageHeader } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Productos" };

const filtersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  estado: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional().catch(undefined),
  categoria: z.string().max(40).optional().catch(undefined),
  tipo: z.enum(["SIMPLE", "KIT"]).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).catch(1),
});

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  await requireAdmin();
  const f = filtersSchema.parse(await searchParams);
  const [{ rows, total, pages }, options] = await Promise.all([
    listAdminProducts({ q: f.q, status: f.estado, categoryId: f.categoria || undefined, type: f.tipo, page: f.pagina }),
    getProductFormOptions(),
  ]);
  const qs = (page: number) => {
    const sp = new URLSearchParams(Object.entries({ q: f.q, estado: f.estado, categoria: f.categoria, tipo: f.tipo }).filter(([, v]) => v) as [string, string][]);
    if (page > 1) sp.set("pagina", String(page));
    return `?${sp}`;
  };

  return (
    <>
      <PageHeader
        title="Productos"
        description={`${total} producto(s)`}
        actions={
          <>
            <ButtonLink href="/admin/importar" variant="outline">
              Carga masiva
            </ButtonLink>
            <ButtonLink href="/admin/productos/nuevo">Nuevo producto</ButtonLink>
          </>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={f.q} placeholder="Buscar por nombre, marca o SKU" className="max-w-xs" />
        <Select name="estado" defaultValue={f.estado ?? ""} className="w-40">
          <option value="">Activos</option>
          <option value="PUBLISHED">Publicados</option>
          <option value="DRAFT">Borradores</option>
          <option value="ARCHIVED">Archivados</option>
        </Select>
        <Select name="categoria" defaultValue={f.categoria ?? ""} className="w-52">
          <option value="">Todas las categorías</option>
          {options.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select name="tipo" defaultValue={f.tipo ?? ""} className="w-36">
          <option value="">Todos</option>
          <option value="SIMPLE">Productos</option>
          <option value="KIT">Kits</option>
        </Select>
        <button className="h-10 rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold">Filtrar</button>
      </form>
      {rows.length ? (
        <ProductTable
          categories={options.categories}
          rows={rows.map((r) => ({
            id: r.id,
            name: r.name,
            sku: r.variants[0]?.sku ?? null,
            imageUrl: r.images[0]?.asset.url ?? null,
            category: r.category?.name ?? null,
            type: r.type,
            saleUnit: r.saleUnit,
            status: r.status,
            price: r.price,
            stock: r.variants.reduce((s, v) => s + Number(v.stock), 0),
          }))}
        />
      ) : (
        <EmptyState>No hay productos con esos filtros.</EmptyState>
      )}
      {pages > 1 ? (
        <nav className="mt-4 flex justify-center gap-2 text-sm">
          {f.pagina > 1 ? <Link href={qs(f.pagina - 1)} className="underline">← Anterior</Link> : null}
          <span className="text-muted">
            Página {f.pagina} de {pages}
          </span>
          {f.pagina < pages ? <Link href={qs(f.pagina + 1)} className="underline">Siguiente →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
