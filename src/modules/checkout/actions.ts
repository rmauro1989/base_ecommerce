"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getBaseUrl } from "@/lib/url";
import { getCustomerSession } from "@/modules/auth/customer";
import { getCart, readCartToken } from "@/modules/cart/service";
import { CATALOG_TAG } from "@/modules/catalog/queries";
import { getProvider } from "@/modules/payments/registry";
import { db } from "@/lib/db";
import { sendOrderConfirmation } from "./notifications";
import { checkoutSchema } from "./schemas";
import { CheckoutError, placeOrder, quoteShipping } from "./service";

export type CheckoutState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Para pasarelas que requieren POST de formulario (Webpay) */
  formPost?: { url: string; fields: Record<string, string> };
} | null;

export async function submitCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Revisa los datos marcados.", fieldErrors };
  }
  const cartToken = await readCartToken();
  if (!cartToken) return { error: "Tu carro está vacío." };
  const customer = await getCustomerSession();

  let order;
  try {
    order = await placeOrder(parsed.data, { cartToken, customerId: customer?.id });
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message, fieldErrors: e.field ? { [e.field]: e.message } : undefined };
    console.error("[checkout]", e);
    return { error: "No pudimos crear tu pedido. Inténtalo nuevamente." };
  }
  revalidateTag(CATALOG_TAG, "max");

  const baseUrl = await getBaseUrl();
  // El correo no debe bloquear ni romper la compra
  sendOrderConfirmation(order.id, baseUrl).catch((e) => console.error("[email]", e));

  const provider = getProvider(order.provider)!;
  const start = await provider.start(
    { id: order.id, number: order.number, publicToken: order.publicToken, total: order.total, email: parsed.data.email, name: parsed.data.name },
    { baseUrl, paymentId: order.paymentId },
  );
  if (start.type !== "instructions" && start.externalId) {
    await db.payment.update({ where: { id: order.paymentId }, data: { externalId: start.externalId } });
  }
  if (start.type === "form_post") return { formPost: { url: start.url, fields: start.fields } };
  if (start.type === "redirect") redirect(start.url);
  redirect(`/pedido/${order.publicToken}?nuevo=1`);
}

/** Cotización de despacho para el resumen del checkout (subtotal calculado en el servidor). */
export async function getShippingQuote(comuna: string) {
  if (typeof comuna !== "string" || !comuna || comuna.length > 80) return null;
  const cart = await getCart();
  return quoteShipping(comuna, cart.subtotal);
}
