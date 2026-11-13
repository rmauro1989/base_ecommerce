"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_QUANTITY, stockRequired, validateLength } from "@/modules/catalog/pricing";
import { availableStock, ensureCart, readCartToken, variantForCartInclude } from "./service";

export type CartActionState = { ok: boolean; message: string } | null;

const addSchema = z.object({
  variantId: z.string().min(1).max(40),
  quantity: z.coerce.number().int().min(1, "Cantidad inválida").max(MAX_QUANTITY),
  length: z
    .union([z.literal(""), z.coerce.number().positive()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
});

export async function addToCart(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const parsed = addSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity") ?? 1,
    length: formData.get("length") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { variantId, quantity } = parsed.data;

  const variant = await db.productVariant.findUnique({ where: { id: variantId }, include: variantForCartInclude });
  if (!variant || !variant.active || variant.product.status !== "PUBLISHED") return { ok: false, message: "Producto no disponible." };
  const p = variant.product;

  const lengthCheck = validateLength(
    {
      saleUnit: p.saleUnit,
      lengthPresets: p.lengthPresets.map(Number),
      allowCustomLength: p.allowCustomLength,
      minLength: p.minLength == null ? null : Number(p.minLength),
      maxLength: p.maxLength == null ? null : Number(p.maxLength),
      lengthStep: p.lengthStep == null ? null : Number(p.lengthStep),
    },
    parsed.data.length,
  );
  if (!lengthCheck.ok) return { ok: false, message: lengthCheck.error };
  const length = lengthCheck.length;

  const cart = await ensureCart();
  const sameVariant = await db.cartItem.findMany({ where: { cartId: cart.id, variantId } });
  const inCart = sameVariant.reduce((s, i) => s + stockRequired(p.saleUnit, i.quantity, i.length == null ? null : Number(i.length)), 0);
  const stock = availableStock(variant);
  if (inCart + stockRequired(p.saleUnit, quantity, length) > stock + 1e-9) {
    const left = Math.max(0, stock - inCart);
    return { ok: false, message: left <= 0 ? "No queda stock disponible para agregar." : `Solo puedes agregar ${left.toLocaleString("es-CL")}${p.saleUnit === "METER" ? " m" : ""} más.` };
  }

  const existing = sameVariant.find((i) => (i.length == null ? null : Number(i.length)) === length);
  if (existing) {
    await db.cartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(MAX_QUANTITY, existing.quantity + quantity) } });
  } else {
    await db.cartItem.create({ data: { cartId: cart.id, variantId, quantity, length } });
  }
  await db.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  refresh();
  return { ok: true, message: "Agregado al carro." };
}

const updateSchema = z.object({ itemId: z.string().min(1).max(40), quantity: z.coerce.number().int().min(0).max(MAX_QUANTITY) });

/** Cambia la cantidad (0 = quitar). Solo afecta ítems del carrito de esta cookie. */
export async function updateCartItem(formData: FormData) {
  const parsed = updateSchema.safeParse({ itemId: formData.get("itemId"), quantity: formData.get("quantity") });
  const token = await readCartToken();
  if (!parsed.success || !token) return;
  const where = { id: parsed.data.itemId, cart: { token } };
  if (parsed.data.quantity === 0) await db.cartItem.deleteMany({ where });
  else await db.cartItem.updateMany({ where, data: { quantity: parsed.data.quantity } });
  refresh();
}

export async function removeCartItem(formData: FormData) {
  const itemId = z.string().min(1).max(40).safeParse(formData.get("itemId"));
  const token = await readCartToken();
  if (!itemId.success || !token) return;
  await db.cartItem.deleteMany({ where: { id: itemId.data, cart: { token } } });
  refresh();
}
