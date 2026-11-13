import { z } from "zod";
import { slugSchemaRegex } from "@/lib/slug";

const money = z.coerce.number().int("Usa un monto entero (sin decimales)").min(0, "No puede ser negativo").max(100_000_000);
const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);
const optionalMoney = z.preprocess(emptyToNull, money.nullable()).default(null);
const meters = z.coerce.number().positive().max(100_000);
const optionalMeters = z.preprocess(emptyToNull, meters.nullable()).default(null);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const variantInputSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(1, "Nombre requerido").max(60),
  sku: optionalText(60),
  priceOverride: optionalMoney,
  stock: z.coerce.number().min(0, "Stock no puede ser negativo").max(10_000_000),
  active: z.boolean().default(true),
  options: z.record(z.string(), z.string().max(60)).optional(),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Nombre requerido").max(150),
    slug: z
      .string()
      .trim()
      .max(80)
      .refine((v) => v === "" || slugSchemaRegex.test(v), "Solo minúsculas, números y guiones"),
    brand: optionalText(60),
    shortDescription: optionalText(300),
    description: optionalText(5000),
    type: z.enum(["SIMPLE", "KIT"]),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    categoryId: optionalText(40),
    saleUnit: z.enum(["UNIT", "METER", "PACK"]),
    price: money.refine((v) => v > 0, "El precio debe ser mayor a 0"),
    compareAtPrice: optionalMoney,
    lengthPresets: z.array(meters).max(12).default([]),
    allowCustomLength: z.boolean().default(false),
    minLength: optionalMeters,
    maxLength: optionalMeters,
    lengthStep: optionalMeters,
    packContent: optionalMeters,
    packLabel: optionalText(40),
    featured: z.boolean().default(false),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    /** ids de MediaAsset en el orden en que se muestran */
    images: z.array(z.object({ assetId: z.string().max(40), alt: optionalText(150) })).max(20).default([]),
    variants: z.array(variantInputSchema).min(1, "Agrega al menos una variante").max(50),
    /** attributeId → valor (texto; se convierte según el tipo) */
    attributes: z.record(z.string().max(40), z.string().trim().max(100)).default({}),
    relatedIds: z.array(z.string().max(40)).max(12).default([]),
    kitItems: z.array(z.object({ variantId: z.string().max(40), quantity: z.coerce.number().positive("Cantidad inválida").max(10_000) })).max(30).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtPrice != null && v.compareAtPrice <= v.price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "El precio anterior debe ser mayor al precio" });
    }
    if (v.saleUnit === "METER") {
      if (!v.lengthPresets.length && !v.allowCustomLength) ctx.addIssue({ code: "custom", path: ["lengthPresets"], message: "Define largos predefinidos o permite medida exacta" });
      if (v.minLength != null && v.maxLength != null && v.minLength > v.maxLength) ctx.addIssue({ code: "custom", path: ["maxLength"], message: "El máximo debe ser mayor al mínimo" });
    }
    if (v.saleUnit === "PACK" && !v.packLabel) ctx.addIssue({ code: "custom", path: ["packLabel"], message: "Indica el nombre del empaque (ej. Rollo 100 m)" });
    if (v.type === "KIT") {
      if (v.saleUnit !== "UNIT") ctx.addIssue({ code: "custom", path: ["saleUnit"], message: "Los kits se venden por unidad" });
      const ids = v.kitItems.map((k) => k.variantId);
      if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["kitItems"], message: "Hay componentes repetidos" });
    }
    const skus = v.variants.map((x) => x.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) ctx.addIssue({ code: "custom", path: ["variants"], message: "Hay SKUs repetidos" });
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormData = z.output<typeof productFormSchema>;

export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("price"), ids: z.array(z.string()).min(1).max(500), percent: z.coerce.number().min(-90, "Mínimo -90%").max(500, "Máximo 500%"), roundTo: z.coerce.number().int().min(1).max(1000).default(10) }),
  z.object({ action: z.literal("publish"), ids: z.array(z.string()).min(1).max(500) }),
  z.object({ action: z.literal("hide"), ids: z.array(z.string()).min(1).max(500) }),
  z.object({ action: z.literal("category"), ids: z.array(z.string()).min(1).max(500), categoryId: z.string().min(1, "Elige una categoría").max(40) }),
]);
export type BulkAction = z.output<typeof bulkActionSchema>;
