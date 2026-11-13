import type { Metadata } from "next";
import { connection } from "next/server";
import { requireAdmin } from "@/modules/auth/admin";
import { ProductForm } from "@/modules/admin/products/components/product-form";
import { emptyProduct } from "@/modules/admin/products/form-state";
import { getAllCategoryFieldsMap, getProductFormOptions } from "@/modules/admin/products/service";
import { PageHeader } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await connection();
  await requireAdmin();
  const isKit = (await searchParams).tipo === "kit";
  const [options, categoryFields] = await Promise.all([getProductFormOptions(), getAllCategoryFieldsMap()]);
  return (
    <>
      <PageHeader title={isKit ? "Nuevo kit" : "Nuevo producto"} />
      <ProductForm
        initial={emptyProduct(isKit ? "KIT" : "SIMPLE")}
        categories={options.categories}
        categoryFields={categoryFields}
        products={options.products}
        componentVariants={options.componentVariants}
      />
    </>
  );
}
