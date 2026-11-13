"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { REGIONES } from "@/lib/chile";
import { normalizeComuna } from "@/modules/checkout/shipping";
import { hashPassword, passwordSchema } from "@/modules/auth/password";
import { adminGuard, failure, invalid, type ActionResult } from "../guard";

const ALL_COMUNAS = new Map(REGIONES.flatMap((r) => r.comunas).map((c) => [normalizeComuna(c), c]));
const money = z.coerce.number().int().min(0).max(10_000_000);

// ─────────────────────────── Zonas de despacho ───────────────────────────

const zoneSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2, "Nombre requerido").max(80),
  comunas: z.string().max(10_000).default(""),
  price: money,
  freeShippingOver: z.union([z.literal(""), money]).transform((v) => (v === "" ? null : v)),
  estimatedDays: z.string().trim().max(60).optional(),
  isFallback: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(false),
  position: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveZoneAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard("OWNER");
    const parsed = zoneSchema.safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      comunas: formData.get("comunas") ?? "",
      price: formData.get("price"),
      freeShippingOver: formData.get("freeShippingOver") ?? "",
      estimatedDays: formData.get("estimatedDays") || undefined,
      isFallback: formData.get("isFallback") === "on",
      active: formData.get("active") === "on",
      position: formData.get("position") || 0,
    });
    if (!parsed.success) return invalid(parsed.error);
    const { id, comunas: raw, ...d } = parsed.data;
    // Normaliza comunas contra el listado oficial
    const unknown: string[] = [];
    const comunas = [
      ...new Set(
        raw
          .split(/[\n,;]/)
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => {
            const official = ALL_COMUNAS.get(normalizeComuna(c));
            if (!official) unknown.push(c);
            return official ?? c;
          }),
      ),
    ];
    if (unknown.length) return { ok: false, message: `Comunas no reconocidas: ${unknown.join(", ")}.`, fieldErrors: { comunas: "Revisa los nombres" } };
    if (!d.isFallback && comunas.length === 0) return { ok: false, message: "Agrega comunas o marca la zona como 'resto del país'.", fieldErrors: { comunas: "Requerido" } };

    // Una comuna no puede estar en dos zonas activas
    const others = await db.shippingZone.findMany({ where: { active: true, ...(id ? { NOT: { id } } : {}) } });
    const dup = comunas.filter((c) => others.some((z) => z.comunas.includes(c)));
    if (d.active && dup.length) return { ok: false, message: `Ya están en otra zona activa: ${dup.join(", ")}.`, fieldErrors: { comunas: "Comunas repetidas" } };

    await db.$transaction(async (tx) => {
      if (d.isFallback) await tx.shippingZone.updateMany({ where: { isFallback: true, ...(id ? { NOT: { id } } : {}) }, data: { isFallback: false } });
      const data = { ...d, comunas, estimatedDays: d.estimatedDays ?? null };
      if (id) await tx.shippingZone.update({ where: { id }, data });
      else await tx.shippingZone.create({ data });
    });
    refresh();
    return { ok: true, message: "Zona guardada." };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteZoneAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard("OWNER");
    await db.shippingZone.delete({ where: { id: z.string().min(1).max(40).parse(formData.get("id")) } });
    refresh();
    return { ok: true, message: "Zona eliminada." };
  } catch (e) {
    return failure(e);
  }
}

const pickupSchema = z.object({
  pickupEnabled: z.coerce.boolean(),
  pickupAddress: z.string().trim().max(200).optional(),
  pickupInstructions: z.string().trim().max(500).optional(),
});

export async function savePickupAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard("OWNER");
    const parsed = pickupSchema.safeParse({
      pickupEnabled: formData.get("pickupEnabled") === "on",
      pickupAddress: formData.get("pickupAddress") || undefined,
      pickupInstructions: formData.get("pickupInstructions") || undefined,
    });
    if (!parsed.success) return invalid(parsed.error);
    if (parsed.data.pickupEnabled && !parsed.data.pickupAddress) return { ok: false, message: "Indica la dirección de retiro.", fieldErrors: { pickupAddress: "Requerida" } };
    await db.storeSettings.update({ where: { id: 1 }, data: { ...parsed.data, pickupAddress: parsed.data.pickupAddress ?? null, pickupInstructions: parsed.data.pickupInstructions ?? null } });
    refresh();
    return { ok: true, message: "Retiro en tienda guardado." };
  } catch (e) {
    return failure(e);
  }
}

// ─────────────────────────── Medios de pago ───────────────────────────

const methodSchema = z.object({
  provider: z.enum(["WEBPAY", "MERCADOPAGO", "MANUAL_TRANSFER"]),
  enabled: z.coerce.boolean(),
  displayName: z.string().trim().min(2, "Requerido").max(80),
  instructions: z.string().trim().max(500).optional(),
  position: z.coerce.number().int().min(0).max(99).default(0),
});

export async function savePaymentMethodAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard("OWNER");
    const parsed = methodSchema.safeParse({
      provider: formData.get("provider"),
      enabled: formData.get("enabled") === "on",
      displayName: formData.get("displayName"),
      instructions: formData.get("instructions") || undefined,
      position: formData.get("position") || 0,
    });
    if (!parsed.success) return invalid(parsed.error);
    const { provider, ...data } = parsed.data;
    await db.paymentMethodSetting.upsert({ where: { provider }, update: { ...data, instructions: data.instructions ?? null }, create: { provider, ...data } });
    refresh();
    return { ok: true, message: "Medio de pago guardado." };
  } catch (e) {
    return failure(e);
  }
}

const bankSchema = z.object({
  banco: z.string().trim().max(60),
  tipoCuenta: z.string().trim().max(40),
  numeroCuenta: z.string().trim().max(40),
  titular: z.string().trim().max(80),
  rut: z.string().trim().max(14),
  email: z.union([z.literal(""), z.string().trim().email("Correo inválido")]),
});

export async function saveBankInfoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    await adminGuard("OWNER");
    const parsed = bankSchema.safeParse(Object.fromEntries(["banco", "tipoCuenta", "numeroCuenta", "titular", "rut", "email"].map((k) => [k, formData.get(k) ?? ""])));
    if (!parsed.success) return invalid(parsed.error);
    await db.storeSettings.update({ where: { id: 1 }, data: { bankTransferInfo: parsed.data } });
    refresh();
    return { ok: true, message: "Datos bancarios guardados." };
  } catch (e) {
    return failure(e);
  }
}

// ─────────────────────────── Usuarios admin ───────────────────────────

const userSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2, "Requerido").max(80),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(150),
  role: z.enum(["OWNER", "EDITOR"]),
  active: z.coerce.boolean(),
  password: z.union([z.literal(""), passwordSchema]).optional(),
});

export async function saveAdminUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const me = await adminGuard("OWNER");
    const parsed = userSchema.safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      active: formData.get("active") === "on",
      password: formData.get("password") ?? "",
    });
    if (!parsed.success) return invalid(parsed.error);
    const { id, password, ...d } = parsed.data;
    if (!id && !password) return { ok: false, message: "Define una contraseña inicial.", fieldErrors: { password: "Requerida" } };

    // Siempre debe quedar al menos un dueño activo
    if (id) {
      const current = await db.adminUser.findUniqueOrThrow({ where: { id } });
      const losesOwner = current.role === "OWNER" && current.active && (d.role !== "OWNER" || !d.active);
      if (losesOwner && (await db.adminUser.count({ where: { role: "OWNER", active: true } })) <= 1) {
        return { ok: false, message: "Debe existir al menos un dueño activo." };
      }
      if (id === me.id && !d.active) return { ok: false, message: "No puedes desactivar tu propio usuario." };
      await db.adminUser.update({ where: { id }, data: { ...d, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
    } else {
      if (await db.adminUser.findUnique({ where: { email: d.email } })) return { ok: false, message: "Ya existe un usuario con ese correo.", fieldErrors: { email: "Ya existe" } };
      await db.adminUser.create({ data: { ...d, passwordHash: await hashPassword(password!) } });
    }
    refresh();
    return { ok: true, message: "Usuario guardado." };
  } catch (e) {
    return failure(e);
  }
}
