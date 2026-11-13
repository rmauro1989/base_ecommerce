"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { slugify, slugSchemaRegex } from "@/lib/slug";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { adminGuard, failure, invalid, type ActionResult } from "../guard";

const categorySchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2, "Nombre requerido").max(80),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine((v) => v === "" || slugSchemaRegex.test(v), "Solo minúsculas, números y guiones"),
  parentId: z.string().max(40).optional(),
  description: z.string().trim().max(500).optional(),
  position: z.coerce.number().int().min(0).max(999).default(0),
  /** "attrId" seleccionados y "attrId" obligatorios */
  attrs: z.array(z.string().max(40)).default([]),
  required: z.array(z.string().max(40)).default([]),
});

/** ¿`candidate` es descendiente de `id`? (evita ciclos en el árbol) */
async function isDescendant(id: string, candidate: string): Promise<boolean> {
  let cur: string | null = candidate;
  for (let i = 0; cur && i < 20; i++) {
    if (cur === id) return true;
    const c: { parentId: string | null } | null = await db.category.findUnique({ where: { id: cur }, select: { parentId: true } });
    cur = c?.parentId ?? null;
  }
  return false;
}

export async function saveCategoryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let savedId: string;
  try {
    await adminGuard();
    const parsed = categorySchema.safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      slug: formData.get("slug") ?? "",
      parentId: formData.get("parentId") || undefined,
      description: formData.get("description") || undefined,
      position: formData.get("position") || 0,
      attrs: formData.getAll("attrs"),
      required: formData.getAll("required"),
    });
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    if (d.id && d.parentId && (await isDescendant(d.id, d.parentId))) {
      return { ok: false, message: "Una categoría no puede ser hija de sí misma ni de sus subcategorías.", fieldErrors: { parentId: "Padre inválido" } };
    }
    const slug = d.slug || slugify(d.name);
    const clash = await db.category.findFirst({ where: { slug, ...(d.id ? { NOT: { id: d.id } } : {}) } });
    if (clash) return { ok: false, message: "Ese slug ya existe.", fieldErrors: { slug: "Ya existe" } };
    const data = { name: d.name, slug, parentId: d.parentId ?? null, description: d.description ?? null, position: d.position };
    savedId = await db.$transaction(async (tx) => {
      const cat = d.id ? await tx.category.update({ where: { id: d.id }, data }) : await tx.category.create({ data });
      await tx.categoryAttribute.deleteMany({ where: { categoryId: cat.id } });
      if (d.attrs.length) {
        await tx.categoryAttribute.createMany({
          data: d.attrs.map((attributeId, i) => ({ categoryId: cat.id, attributeId, required: d.required.includes(attributeId), position: i })),
        });
      }
      return cat.id;
    });
    updateTag(CATALOG_TAG);
  } catch (e) {
    return failure(e);
  }
  redirect(`/admin/categorias?editar=${savedId}&ok=1`);
}

export async function deleteCategoryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard();
    const id = z.string().min(1).max(40).parse(formData.get("id"));
    const [children, products] = await Promise.all([db.category.count({ where: { parentId: id } }), db.product.count({ where: { categoryId: id } })]);
    if (children || products) {
      return { ok: false, message: `No se puede eliminar: tiene ${children} subcategoría(s) y ${products} producto(s). Muévelos primero.` };
    }
    await db.category.delete({ where: { id } });
    updateTag(CATALOG_TAG);
  } catch (e) {
    return failure(e);
  }
  redirect("/admin/categorias?eliminada=1");
}

const attributeSchema = z
  .object({
    id: z.string().max(40).optional(),
    key: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z][a-z0-9_]{0,39}$/, "Solo minúsculas, números y _ (ej: seccion_mm2)"),
    label: z.string().trim().min(1, "Requerido").max(60),
    type: z.enum(["NUMBER", "TEXT", "SELECT", "BOOLEAN"]),
    unit: z.string().trim().max(15).optional(),
    options: z.string().max(2000).default(""),
    filterable: z.coerce.boolean().default(false),
    position: z.coerce.number().int().min(0).max(999).default(0),
  })
  .transform((v) => ({
    ...v,
    options: v.type === "SELECT" ? [...new Set(v.options.split(/[\n,]/).map((o) => o.trim()).filter(Boolean))].slice(0, 50) : [],
  }))
  .refine((v) => v.type !== "SELECT" || v.options.length > 0, { path: ["options"], message: "Agrega al menos una opción" });

export async function saveAttributeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard();
    const parsed = attributeSchema.safeParse({
      id: formData.get("id") || undefined,
      key: formData.get("key"),
      label: formData.get("label"),
      type: formData.get("type"),
      unit: formData.get("unit") || undefined,
      options: formData.get("options") ?? "",
      filterable: formData.get("filterable") === "on",
      position: formData.get("position") || 0,
    });
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;
    const clash = await db.attributeDefinition.findFirst({ where: { key: data.key, ...(id ? { NOT: { id } } : {}) } });
    if (clash) return { ok: false, message: "Esa clave ya existe.", fieldErrors: { key: "Ya existe" } };
    if (id) {
      const prev = await db.attributeDefinition.findUnique({ where: { id } });
      if (prev && prev.type !== data.type && (await db.productAttributeValue.count({ where: { attributeId: id } }))) {
        return { ok: false, message: "No se puede cambiar el tipo: hay productos con valores en este atributo.", fieldErrors: { type: "En uso" } };
      }
      await db.attributeDefinition.update({ where: { id }, data: { ...data, unit: data.unit ?? null } });
    } else {
      await db.attributeDefinition.create({ data: { ...data, unit: data.unit ?? null } });
    }
    updateTag(CATALOG_TAG);
  } catch (e) {
    return failure(e);
  }
  redirect("/admin/atributos?ok=1");
}

export async function deleteAttributeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard();
    const id = z.string().min(1).max(40).parse(formData.get("id"));
    const used = await db.productAttributeValue.count({ where: { attributeId: id } });
    if (used) return { ok: false, message: `No se puede eliminar: ${used} producto(s) tienen este dato en su ficha técnica.` };
    await db.attributeDefinition.delete({ where: { id } });
    updateTag(CATALOG_TAG);
  } catch (e) {
    return failure(e);
  }
  redirect("/admin/atributos?eliminado=1");
}
