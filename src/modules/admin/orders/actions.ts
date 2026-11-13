"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { sendMail } from "@/modules/email/mailer";
import { orderStatusEmail } from "@/modules/email/templates";
import { ORDER_STATUS_LABEL } from "@/modules/orders/labels";
import { changeOrderStatus, OrderTransitionError } from "@/modules/orders/service";
import { getActiveTheme, getStoreSettings } from "@/modules/theme/server";
import { adminGuard, failure, invalid, type ActionResult } from "../guard";

const statusSchema = z.object({
  orderId: z.string().min(1).max(40),
  to: z.enum(["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "READY_FOR_PICKUP", "DELIVERED", "CANCELLED", "REFUNDED"]),
  comment: z.string().trim().max(500).optional(),
  notify: z.coerce.boolean().default(false),
});

export async function changeStatusAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await adminGuard();
    const parsed = statusSchema.safeParse({
      orderId: formData.get("orderId"),
      to: formData.get("to"),
      comment: formData.get("comment") || undefined,
      notify: formData.get("notify") === "on",
    });
    if (!parsed.success) return invalid(parsed.error);
    const order = await changeOrderStatus({ orderId: parsed.data.orderId, to: parsed.data.to, adminUserId: admin.id, comment: parsed.data.comment });
    updateTag(CATALOG_TAG); // el stock pudo cambiar
    if (parsed.data.notify) {
      const [store, theme, base] = await Promise.all([getStoreSettings(), getActiveTheme(), getBaseUrl()]);
      const mail = orderStatusEmail({
        storeName: store.storeName,
        theme,
        orderNumber: order.number,
        name: order.name,
        statusLabel: ORDER_STATUS_LABEL[parsed.data.to],
        note: parsed.data.comment,
        orderUrl: `${base}/pedido/${order.publicToken}`,
      });
      await sendMail({ to: order.email, ...mail });
    }
    refresh();
    return { ok: true, message: `Estado cambiado a "${ORDER_STATUS_LABEL[parsed.data.to]}".` };
  } catch (e) {
    if (e instanceof OrderTransitionError) return { ok: false, message: e.message };
    return failure(e);
  }
}

const noteSchema = z.object({
  orderId: z.string().min(1).max(40),
  body: z.string().trim().min(1, "Escribe la nota").max(2000),
  visible: z.coerce.boolean().default(false),
});

export async function addNoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await adminGuard();
    const parsed = noteSchema.safeParse({ orderId: formData.get("orderId"), body: formData.get("body"), visible: formData.get("visible") === "on" });
    if (!parsed.success) return invalid(parsed.error);
    await db.orderNote.create({ data: { orderId: parsed.data.orderId, body: parsed.data.body, internal: !parsed.data.visible, authorId: admin.id } });
    refresh();
    return { ok: true, message: "Nota agregada." };
  } catch (e) {
    return failure(e);
  }
}
