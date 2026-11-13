import "server-only";
import { db } from "@/lib/db";
import { getAllCategoryFieldsMap } from "../products/service";
import type { ImportContext } from "./validate";

export type JobData = { headers: string[]; rows: string[][]; overflowRows?: number[] };

export async function loadImportContext(skus: string[]): Promise<ImportContext> {
  const [categories, categoryFields, attributes, variants, slugs] = await Promise.all([
    db.category.findMany({ select: { id: true, slug: true, name: true } }),
    getAllCategoryFieldsMap(),
    db.attributeDefinition.findMany({ select: { id: true, key: true, label: true, type: true, options: true } }),
    db.productVariant.findMany({
      where: { sku: { in: skus } },
      select: { id: true, sku: true, product: { select: { id: true, name: true, categoryId: true, saleUnit: true } } },
    }),
    db.product.findMany({ select: { slug: true } }),
  ]);
  return {
    categories,
    categoryFields,
    attributes,
    existingSkus: Object.fromEntries(
      variants.map((v) => [v.sku!, { productId: v.product.id, variantId: v.id, productName: v.product.name, categoryId: v.product.categoryId, saleUnit: v.product.saleUnit }]),
    ),
    existingSlugs: slugs.map((s) => s.slug),
  };
}

/** SKUs del archivo según el mapeo (para buscar los existentes). */
export function skusFromJob(data: JobData, mapping: Record<string, string>) {
  const i = data.headers.findIndex((h) => mapping[h] === "sku");
  return i < 0 ? [] : data.rows.map((r) => (r[i] ?? "").trim().toUpperCase()).filter(Boolean);
}
