import "server-only";
import { db } from "@/lib/db";
import { sendMail } from "@/modules/email/mailer";
import { orderConfirmationEmail } from "@/modules/email/templates";
import { getActiveTheme, getStoreSettings } from "@/modules/theme/server";

const BANK_LABELS: Record<string, string> = {
  banco: "Banco",
  tipoCuenta: "Tipo de cuenta",
  numeroCuenta: "N° de cuenta",
  titular: "Titular",
  rut: "RUT",
  email: "Correo",
};

export async function sendOrderConfirmation(orderId: string, baseUrl: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const [store, theme, settings, method] = await Promise.all([
    getStoreSettings(),
    getActiveTheme(),
    db.storeSettings.findUnique({ where: { id: 1 } }),
    db.paymentMethodSetting.findUnique({ where: { provider: order.paymentProvider } }),
  ]);
  const bankRaw = order.paymentProvider === "MANUAL_TRANSFER" ? ((settings?.bankTransferInfo ?? null) as Record<string, string> | null) : null;
  const bankInfo = bankRaw ? Object.fromEntries(Object.entries(bankRaw).map(([k, v]) => [BANK_LABELS[k] ?? k, v])) : null;
  const mail = orderConfirmationEmail({
    storeName: store.storeName,
    theme,
    orderUrl: `${baseUrl}/pedido/${order.publicToken}`,
    paymentLabel: method?.displayName ?? order.paymentProvider,
    paymentInstructions: order.paymentProvider === "MANUAL_TRANSFER" ? method?.instructions : null,
    bankInfo,
    pickupAddress: settings?.pickupAddress,
    order: {
      number: order.number,
      name: order.name,
      fulfillment: order.fulfillment,
      shippingAddress: order.shippingAddress as never,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      total: order.total,
      items: order.items.map((i) => ({ ...i, length: i.length == null ? null : Number(i.length) })),
    },
  });
  await sendMail({ to: order.email, ...mail, replyTo: store.contactEmail ?? undefined });
}
