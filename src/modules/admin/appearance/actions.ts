"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { HOME_TAG } from "@/modules/home/queries";
import { contrastFailures } from "@/modules/theme/contrast";
import { diffFromPreset, isPresetKey } from "@/modules/theme/resolve";
import { STORE_SETTINGS_TAG } from "@/modules/theme/server";
import { themeTokensSchema } from "@/modules/theme/tokens";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { adminGuard, failure, invalid, type ActionResult } from "../guard";

const appearanceSchema = z.object({
  storeName: z.string().trim().min(2, "Requerido").max(80),
  contactEmail: z.union([z.literal(""), z.string().trim().email("Correo inválido")]),
  contactPhone: z.string().trim().max(30),
  seoDescription: z.string().trim().max(160),
  preset: z.string().refine(isPresetKey, "Preset inválido"),
  tokens: themeTokensSchema,
  logoAssetId: z.string().max(40).nullable(),
  faviconAssetId: z.string().max(40).nullable(),
  acceptLowContrast: z.boolean().default(false),
});

export type AppearanceResult = (NonNullable<ActionResult> & { contrastWarning?: string[] }) | null;

export async function saveAppearanceAction(_prev: AppearanceResult, formData: FormData): Promise<AppearanceResult> {
  try {
    await adminGuard("OWNER");
    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "Datos inválidos." };
    }
    const parsed = appearanceSchema.safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;

    // Verificación de contraste AA: avisa y pide confirmación explícita
    const failures = contrastFailures(d.tokens);
    if (failures.length && !d.acceptLowContrast) {
      return {
        ok: false,
        message: "El tema no cumple el contraste mínimo AA. Ajusta los colores o confirma que quieres guardarlo igual.",
        contrastWarning: failures.map((f) => `${f.label}: ${f.ratio.toFixed(2)}:1 (mínimo ${f.required}:1)`),
      };
    }

    for (const id of [d.logoAssetId, d.faviconAssetId]) {
      if (id && !(await db.mediaAsset.findUnique({ where: { id } }))) return { ok: false, message: "La imagen subida ya no existe. Súbela nuevamente." };
    }

    const overrides = diffFromPreset(d.preset as Parameters<typeof diffFromPreset>[0], d.tokens);
    await db.storeSettings.update({
      where: { id: 1 },
      data: {
        storeName: d.storeName,
        contactEmail: d.contactEmail || null,
        contactPhone: d.contactPhone || null,
        seoDescription: d.seoDescription || null,
        themePreset: d.preset,
        themeOverrides: overrides,
        logoAssetId: d.logoAssetId,
        faviconAssetId: d.faviconAssetId,
      },
    });
    updateTag(STORE_SETTINGS_TAG);
    return { ok: true, message: failures.length ? "Guardado (con advertencia de contraste)." : "Apariencia guardada. Contraste AA verificado ✓" };
  } catch (e) {
    return failure(e);
  }
}

// ─────────────────────────── Contenido del inicio ───────────────────────────

const sectionSchema = z.object({
  id: z.string().max(40).optional(),
  type: z.enum(["HERO", "CATEGORIES", "KITS", "BESTSELLERS", "FEATURED", "BANNER"]),
  enabled: z.boolean(),
  title: z.string().trim().max(120).nullable(),
  subtitle: z.string().trim().max(240).nullable(),
  limit: z.coerce.number().int().min(1).max(24).nullable().optional(),
  href: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || v.startsWith("/"), "El enlace debe ser interno (empezar con /)")
    .nullable()
    .optional(),
  cta: z.string().trim().max(40).nullable().optional(),
});

export async function saveHomeSectionsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard("OWNER");
    let raw: unknown;
    try {
      raw = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "Datos inválidos." };
    }
    const parsed = z.array(sectionSchema).max(20).safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    await db.$transaction(async (tx) => {
      const keep = parsed.data.map((s) => s.id).filter(Boolean) as string[];
      await tx.homeSection.deleteMany({ where: { id: { notIn: keep } } });
      for (const [position, s] of parsed.data.entries()) {
        const config = s.type === "BANNER" ? { href: s.href || null, cta: s.cta || null } : s.limit ? { limit: s.limit } : {};
        const data = { type: s.type, enabled: s.enabled, title: s.title || null, subtitle: s.subtitle || null, position, config };
        if (s.id) await tx.homeSection.update({ where: { id: s.id }, data });
        else await tx.homeSection.create({ data });
      }
    });
    updateTag(HOME_TAG);
    updateTag(CATALOG_TAG);
    return { ok: true, message: "Inicio actualizado." };
  } catch (e) {
    return failure(e);
  }
}
