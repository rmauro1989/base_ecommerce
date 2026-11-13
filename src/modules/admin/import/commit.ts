import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { importImageFromUrl } from "@/modules/media/remote";
import { getCategoryAttributeFields } from "../products/service";
import { isReadyToPublish, productReadiness } from "../products/readiness";
import type { ImportPlan, PlannedProduct } from "./validate";

export type CommitSummary = {
  created: number;
  updated: number;
  variantsCreated: number;
  published: number;
  drafts: string[];
  failed: { name: string; error: string }[];
  imageErrors: string[];
};

const nn = <T,>(v: T | null | undefined) => (v === null || v === undefined ? undefined : v);

async function downloadImages(p: PlannedProduct, errors: string[]) {
  const ids: string[] = [];
  for (const url of p.images) {
    try {
      ids.push((await importImageFromUrl(url)).id);
    } catch (e) {
      errors.push(`${p.name}: ${url} → ${(e as Error).message}`);
    }
  }
  return ids;
}

/** Aplica el plan. Cada producto va en su propia transacción: un error no frena al resto. */
export async function commitImportPlan(plan: ImportPlan, opts: { allowPublish: boolean }): Promise<CommitSummary> {
  const summary: CommitSummary = { created: 0, updated: 0, variantsCreated: 0, published: 0, drafts: [], failed: [], imageErrors: [] };

  for (const p of plan.products) {
    try {
      const assetIds = await downloadImages(p, summary.imageErrors);
      await db.$transaction(async (tx) => {
        let productId = p.existingProductId;
        const fields = {
          brand: nn(p.brand),
          shortDescription: nn(p.shortDescription),
          description: nn(p.description),
          categoryId: nn(p.categoryId),
          saleUnit: nn(p.saleUnit),
          price: nn(p.price),
          compareAtPrice: nn(p.compareAtPrice),
          lengthPresets: p.lengthPresets ? p.lengthPresets.map((n) => new Prisma.Decimal(n)) : undefined,
          allowCustomLength: nn(p.allowCustomLength),
          minLength: nn(p.minLength),
          maxLength: nn(p.maxLength),
          lengthStep: nn(p.lengthStep),
          packLabel: nn(p.packLabel),
          packContent: nn(p.packContent),
        };

        if (productId) {
          await tx.product.update({ where: { id: productId }, data: { ...fields, ...(p.name ? { name: p.name } : {}) } });
          summary.updated++;
        } else {
          const created = await tx.product.create({
            data: { ...fields, name: p.name, slug: p.slug!, price: p.price!, saleUnit: p.saleUnit ?? "UNIT", status: "DRAFT" },
          });
          productId = created.id;
          summary.created++;
        }

        // Variantes (upsert por SKU)
        const existingCount = await tx.productVariant.count({ where: { productId } });
        for (const [i, v] of p.variants.entries()) {
          const bySku = await tx.productVariant.findUnique({ where: { sku: v.sku } });
          if (bySku) {
            await tx.productVariant.update({
              where: { id: bySku.id },
              data: { ...(v.name ? { name: v.name } : {}), ...(v.stock != null ? { stock: v.stock } : {}), ...(v.priceOverride != null ? { priceOverride: v.priceOverride } : {}), active: true },
            });
          } else {
            await tx.productVariant.create({
              data: { productId, sku: v.sku, name: v.name || "Por defecto", stock: v.stock ?? 0, priceOverride: v.priceOverride, position: existingCount + i, isDefault: existingCount === 0 && i === 0 },
            });
            summary.variantsCreated++;
          }
        }

        // Ficha técnica (solo los valores presentes en el archivo)
        for (const a of p.attributes) {
          const data = { valueText: a.valueText ?? null, valueNumber: a.valueNumber ?? null, valueBool: a.valueBool ?? null };
          await tx.productAttributeValue.upsert({ where: { productId_attributeId: { productId, attributeId: a.attributeId } }, update: data, create: { productId, attributeId: a.attributeId, ...data } });
        }

        // Fotos nuevas al final
        if (assetIds.length) {
          const last = await tx.productImage.aggregate({ where: { productId }, _max: { position: true } });
          const start = (last._max.position ?? -1) + 1;
          await tx.productImage.createMany({ data: assetIds.map((assetId, i) => ({ productId: productId!, assetId, position: start + i, alt: p.name })) });
        }

        // Publicación (solo si se pidió y cumple el checklist)
        if (p.status) {
          let status = p.status;
          if (status === "PUBLISHED") {
            const prod = await tx.product.findUniqueOrThrow({
              where: { id: productId },
              include: { _count: { select: { images: true } }, variants: { select: { stock: true } }, attributes: { select: { attributeId: true } } },
            });
            const fieldsReq = await getCategoryAttributeFields(prod.categoryId, tx);
            const readiness = productReadiness({
              name: prod.name,
              price: prod.price,
              categoryId: prod.categoryId,
              imageCount: prod._count.images,
              shortDescription: prod.shortDescription,
              type: prod.type,
              saleUnit: prod.saleUnit,
              lengthPresets: prod.lengthPresets.map(Number),
              allowCustomLength: prod.allowCustomLength,
              totalStock: prod.variants.reduce((s, v) => s + Number(v.stock), 0),
              kitItemCount: 0,
              requiredAttributes: fieldsReq.filter((f) => f.required).map((f) => ({ label: f.label, filled: prod.attributes.some((x) => x.attributeId === f.id) })),
            });
            if (!opts.allowPublish || !isReadyToPublish(readiness)) {
              status = "DRAFT";
              summary.drafts.push(prod.name);
            } else summary.published++;
          }
          const current = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { publishedAt: true } });
          await tx.product.update({ where: { id: productId }, data: { status, ...(status === "PUBLISHED" && !current.publishedAt ? { publishedAt: new Date() } : {}) } });
        }
      });
    } catch (e) {
      const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002" ? "SKU o slug ya en uso" : (e as Error).message;
      summary.failed.push({ name: p.name, error: msg });
    }
  }
  return summary;
}
