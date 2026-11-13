import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/modules/auth/admin";
import { archiveProductAction } from "@/modules/admin/products/actions";
import { ProductForm } from "@/modules/admin/products/components/product-form";
import { getAllCategoryFieldsMap, getProductForEdit, getProductFormOptions } from "@/modules/admin/products/service";
import { PageHeader } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  const [product, options, categoryFields] = await Promise.all([getProductForEdit(id), getProductFormOptions(), getAllCategoryFieldsMap()]);
  if (!product) notFound();
  const created = (await searchParams).creado;
  return (
    <>
      <PageHeader
        title={product.initial.name}
        description={product.initial.type === "KIT" ? "Kit" : "Producto"}
        actions={
          product.initial.status !== "ARCHIVED" ? (
            <form action={archiveProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <Button type="submit" variant="ghost" size="sm">
                Archivar
              </Button>
            </form>
          ) : null
        }
      />
      {created ? <p className="mb-4 rounded-md border border-success p-3 text-sm text-success">Producto creado.</p> : null}
      <ProductForm
        key={product.id}
        id={product.id}
        slug={product.slug}
        initial={product.initial}
        categories={options.categories}
        categoryFields={categoryFields}
        products={options.products}
        componentVariants={options.componentVariants}
      />
    </>
  );
}
