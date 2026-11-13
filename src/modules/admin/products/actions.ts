"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { saveImage, UploadError, type UploadKind } from "@/modules/media/upload";
import { adminGuard, failure, invalid, type ActionResult } from "../guard";
import { bulkActionSchema, productFormSchema } from "./schemas";
import { bulkUpdateProducts, ProductValidationError, saveProduct } from "./service";

export async function saveProductAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let result: { id: string };
  const id = formData.get("id");
  try {
    await adminGuard();
    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "Datos del formulario inválidos." };
    }
    const parsed = productFormSchema.safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    result = await saveProduct(parsed.data, typeof id === "string" && id ? id : null);
  } catch (e) {
    if (e instanceof ProductValidationError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors };
    return failure(e);
  }
  updateTag(CATALOG_TAG);
  if (!id) redirect(`/admin/productos/${result.id}?creado=1`);
  return { ok: true, message: "Cambios guardados." };
}

export type UploadResult = { ok: true; assets: { id: string; url: string }[]; errors: string[] } | { ok: false; message: string };

export async function uploadImagesAction(formData: FormData): Promise<UploadResult> {
  try {
    await adminGuard();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const kind = z.enum(["product", "logo", "favicon", "category"]).catch("product").parse(formData.get("kind")) as UploadKind;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 20);
  const assets: { id: string; url: string }[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      const a = await saveImage(f, kind);
      assets.push({ id: a.id, url: a.url });
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof UploadError ? e.message : "error al procesar"}`);
      if (!(e instanceof UploadError)) console.error("[upload]", e);
    }
  }
  return { ok: true, assets, errors };
}

export async function bulkProductsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard();
    const parsed = bulkActionSchema.safeParse({
      action: formData.get("action"),
      ids: formData.getAll("ids"),
      percent: formData.get("percent") ?? undefined,
      roundTo: formData.get("roundTo") || undefined,
      categoryId: formData.get("categoryId") ?? undefined,
    });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Selecciona productos y una acción." };
    const r = await bulkUpdateProducts(parsed.data);
    updateTag(CATALOG_TAG);
    const skipped = r.skipped.length ? ` No se publicaron (checklist incompleto): ${r.skipped.join(", ")}.` : "";
    return { ok: r.skipped.length === 0, message: `${r.updated} producto(s) actualizado(s).${skipped}` };
  } catch (e) {
    if (e instanceof ProductValidationError) return { ok: false, message: e.message };
    return failure(e);
  }
}

export async function archiveProductAction(formData: FormData) {
  await adminGuard();
  const id = z.string().min(1).max(40).parse(formData.get("id"));
  await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
  updateTag(CATALOG_TAG);
  redirect("/admin/productos?archivado=1");
}
