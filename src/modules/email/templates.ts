import { formatCLP, formatNumber } from "@/lib/money";
import type { ThemeTokens } from "@/modules/theme/tokens";
import { pickOnColor } from "@/modules/theme/contrast";

type OrderForEmail = {
  number: number;
  name: string;
  fulfillment: "SHIPPING" | "PICKUP";
  shippingAddress: { street: string; number: string; apartment?: string | null; comuna: string; region: string } | null;
  subtotal: number;
  shippingCost: number;
  total: number;
  items: { name: string; variantName: string | null; quantity: number; length: number | null; saleUnit: string; lineTotal: number }[];
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function itemDescription(i: { name: string; variantName: string | null; quantity: number; length: number | null; saleUnit: string }) {
  const variant = i.variantName ? ` · ${i.variantName}` : "";
  const qty = i.saleUnit === "METER" && i.length ? `${i.quantity} × ${formatNumber(i.length)} m` : `${i.quantity} ×`;
  return `${qty} ${i.name}${variant}`;
}

/** Correo de confirmación. Los colores salen del tema activo (los clientes de correo no leen variables CSS). */
export function orderConfirmationEmail(opts: {
  storeName: string;
  theme: ThemeTokens;
  order: OrderForEmail;
  orderUrl: string;
  paymentLabel: string;
  paymentInstructions?: string | null;
  bankInfo?: Record<string, string> | null;
  pickupAddress?: string | null;
}) {
  const { order, theme: t } = opts;
  const subject = `Pedido #${order.number} recibido · ${opts.storeName}`;
  const rows = order.items
    .map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid ${t.colorSurface}">${esc(itemDescription(i))}</td><td align="right" style="padding:6px 0;border-bottom:1px solid ${t.colorSurface}">${formatCLP(i.lineTotal)}</td></tr>`)
    .join("");
  const address =
    order.fulfillment === "SHIPPING" && order.shippingAddress
      ? `Despacho a: ${esc(`${order.shippingAddress.street} ${order.shippingAddress.number}${order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}, ${order.shippingAddress.comuna}, ${order.shippingAddress.region}`)}`
      : `Retiro en tienda${opts.pickupAddress ? `: ${esc(opts.pickupAddress)}` : ""}`;
  const bank = opts.bankInfo
    ? `<table style="margin-top:8px;font-size:14px">${Object.entries(opts.bankInfo)
        .filter(([, v]) => v)
        .map(([k, v]) => `<tr><td style="padding-right:12px;color:${t.colorMuted}">${esc(k)}</td><td>${esc(String(v))}</td></tr>`)
        .join("")}</table>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:${t.colorBg};font-family:Arial,Helvetica,sans-serif;color:${t.colorText}">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:${t.colorPrimary};color:${pickOnColor(t.colorPrimary)};padding:16px 20px;border-radius:${t.radius}px;font-size:20px;font-weight:bold">${esc(opts.storeName)}</div>
  <div style="background:${t.colorSurface};padding:20px;margin-top:12px;border-radius:${t.radius}px">
    <h1 style="font-size:20px;margin:0 0 8px">¡Gracias, ${esc(order.name.split(" ")[0])}!</h1>
    <p style="margin:0 0 16px;color:${t.colorMuted}">Recibimos tu pedido <strong style="color:${t.colorText}">#${order.number}</strong>.</p>
    <table width="100%" style="font-size:14px;border-collapse:collapse">${rows}
      <tr><td style="padding-top:10px;color:${t.colorMuted}">Subtotal</td><td align="right" style="padding-top:10px">${formatCLP(order.subtotal)}</td></tr>
      <tr><td style="color:${t.colorMuted}">Despacho</td><td align="right">${order.shippingCost ? formatCLP(order.shippingCost) : "Gratis"}</td></tr>
      <tr><td style="font-weight:bold;padding-top:6px">Total</td><td align="right" style="font-weight:bold;padding-top:6px">${formatCLP(order.total)}</td></tr>
    </table>
    <p style="font-size:14px;margin:16px 0 0">${address}</p>
    <p style="font-size:14px;margin:8px 0 0">Medio de pago: ${esc(opts.paymentLabel)}</p>
    ${opts.paymentInstructions ? `<p style="font-size:14px;margin:8px 0 0">${esc(opts.paymentInstructions)}</p>` : ""}
    ${bank}
    <p style="margin:20px 0 0"><a href="${esc(opts.orderUrl)}" style="display:inline-block;background:${t.colorPrimary};color:${pickOnColor(t.colorPrimary)};padding:10px 16px;border-radius:${t.radius}px;text-decoration:none;font-weight:bold">Ver mi pedido</a></p>
  </div>
</div></body></html>`;
  const text = [
    `¡Gracias, ${order.name}! Recibimos tu pedido #${order.number}.`,
    "",
    ...order.items.map((i) => `${itemDescription(i)} — ${formatCLP(i.lineTotal)}`),
    "",
    `Subtotal: ${formatCLP(order.subtotal)}`,
    `Despacho: ${order.shippingCost ? formatCLP(order.shippingCost) : "Gratis"}`,
    `Total: ${formatCLP(order.total)}`,
    "",
    address.replace(/&[a-z]+;/g, ""),
    `Medio de pago: ${opts.paymentLabel}`,
    opts.paymentInstructions ?? "",
    ...(opts.bankInfo ? Object.entries(opts.bankInfo).map(([k, v]) => `${k}: ${v}`) : []),
    "",
    `Ver pedido: ${opts.orderUrl}`,
  ].join("\n");
  return { subject, html, text };
}
