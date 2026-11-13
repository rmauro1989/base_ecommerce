"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { adminGuard, failure, type ActionResult } from "../guard";
import { commitImportPlan } from "./commit";
import { IGNORE, IMPORT_FIELDS, autoMap } from "./fields";
import { ImportParseError, MAX_FILE_BYTES, parseImportFile } from "./parse";
import { loadImportContext, skusFromJob, type JobData } from "./service";
import { buildImportPlan, missingRequiredMappings } from "./validate";

export async function uploadImportAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let jobId: string;
  try {
    const admin = await adminGuard();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Elige un archivo .xlsx o .csv." };
    if (file.size > MAX_FILE_BYTES) return { ok: false, message: "El archivo supera 5 MB." };
    let table;
    try {
      table = await parseImportFile(new Uint8Array(await file.arrayBuffer()), file.name);
    } catch (e) {
      if (e instanceof ImportParseError) return { ok: false, message: e.message };
      throw e;
    }
    const attributes = await db.attributeDefinition.findMany({ select: { key: true, label: true } });
    const mapping = autoMap(table.headers, attributes);
    const job = await db.importJob.create({
      data: { fileName: file.name.slice(0, 200), createdById: admin.id, mapping, rows: table as unknown as Prisma.InputJsonValue },
    });
    jobId = job.id;
  } catch (e) {
    return failure(e);
  }
  redirect(`/admin/importar/${jobId}`);
}

export async function saveMappingAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let jobId: string;
  try {
    await adminGuard();
    jobId = z.string().min(1).max(40).parse(formData.get("jobId"));
    const job = await db.importJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== "PREVIEW") return { ok: false, message: "Esta importación ya no se puede editar." };
    const data = job.rows as unknown as JobData;
    const allowed = new Set([IGNORE, ...IMPORT_FIELDS.map((f) => f.key), ...(await db.attributeDefinition.findMany({ select: { key: true } })).map((a) => `attr:${a.key}`)]);
    const mapping: Record<string, string> = {};
    const used = new Map<string, string>();
    for (const [i, h] of data.headers.entries()) {
      const v = String(formData.get(`map_${i}`) ?? IGNORE);
      if (!allowed.has(v)) return { ok: false, message: `Campo desconocido para la columna "${h}".` };
      if (v !== IGNORE && used.has(v)) return { ok: false, message: `Las columnas "${used.get(v)}" y "${h}" están asignadas al mismo campo.` };
      if (v !== IGNORE) used.set(v, h);
      mapping[h] = v;
    }
    const missing = missingRequiredMappings(mapping);
    if (missing.length) return { ok: false, message: `Asigna una columna a: ${missing.map((m) => IMPORT_FIELDS.find((f) => f.key === m)!.label).join(", ")}.` };
    await db.importJob.update({ where: { id: jobId }, data: { mapping } });
  } catch (e) {
    return failure(e);
  }
  redirect(`/admin/importar/${jobId}?paso=revisar`);
}

export async function commitImportAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let jobId: string;
  try {
    await adminGuard();
    jobId = z.string().min(1).max(40).parse(formData.get("jobId"));
    const allowPublish = formData.get("allowPublish") === "on";
    // Marca el trabajo como en curso de forma atómica (evita doble confirmación)
    const lock = await db.importJob.updateMany({ where: { id: jobId, status: "PREVIEW" }, data: { status: "COMMITTED" } });
    if (lock.count === 0) return { ok: false, message: "Esta importación ya fue confirmada." };
    const job = await db.importJob.findUniqueOrThrow({ where: { id: jobId } });
    const data = job.rows as unknown as JobData;
    const mapping = job.mapping as Record<string, string>;
    try {
      const ctx = await loadImportContext(skusFromJob(data, mapping));
      const plan = buildImportPlan(data.headers, data.rows, mapping, ctx, { overflowRows: data.overflowRows });
      if (!plan.products.length) {
        await db.importJob.update({ where: { id: jobId }, data: { status: "PREVIEW" } });
        return { ok: false, message: "No hay productos válidos para importar." };
      }
      const summary = await commitImportPlan(plan, { allowPublish });
      await db.importJob.update({ where: { id: jobId }, data: { summary: { ...summary, skippedRows: plan.summary.skippedRows } } });
    } catch (e) {
      await db.importJob.update({ where: { id: jobId }, data: { status: "FAILED", summary: { error: (e as Error).message } } });
      throw e;
    }
    updateTag(CATALOG_TAG);
  } catch (e) {
    return failure(e);
  }
  redirect(`/admin/importar/${jobId}`);
}
