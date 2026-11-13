import { Badge } from "@/components/ui/badge";
import { formatCLP } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";
import { itemDescription } from "@/modules/email/templates";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "./labels";

export type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

type Address = { street: string; number: string; apartment?: string | null; comuna: string; region: string; notes?: string | null };

/** Detalle de pedido reutilizado en /pedido/[token], /cuenta y el admin. */
export function OrderDetail({ order, paymentLabel, pickupAddress }: { order: OrderWithItems; paymentLabel: string; pickupAddress?: string | null }) {
  const addr = order.shippingAddress as Address | null;
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <div>
          <p className="font-display text-lg font-bold">Pedido #{order.number}</p>
          <p className="text-xs text-muted">{order.createdAt.toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short", timeZone: "America/Santiago" })}</p>
        </div>
        <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>
      <ul className="divide-y divide-border px-4 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 py-2.5">
            <span>{itemDescription({ ...i, length: i.length == null ? null : Number(i.length) })}</span>
            <span className="shrink-0">{formatCLP(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid gap-1 border-t border-border p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd>{formatCLP(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Despacho{order.shippingZoneName ? ` (${order.shippingZoneName})` : ""}</dt>
          <dd>{order.fulfillment === "PICKUP" ? "Retiro" : order.shippingCost ? formatCLP(order.shippingCost) : "Gratis"}</dd>
        </div>
        <div className="flex justify-between pt-1 text-base font-bold">
          <dt>Total</dt>
          <dd className="font-display">{formatCLP(order.total)}</dd>
        </div>
      </dl>
      <div className="grid gap-4 border-t border-border p-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold">{order.fulfillment === "SHIPPING" ? "Despacho a" : "Retiro en tienda"}</p>
          {addr ? (
            <p className="text-muted">
              {addr.street} {addr.number}
              {addr.apartment ? `, ${addr.apartment}` : ""}
              <br />
              {addr.comuna}, {addr.region}
              {addr.notes ? (
                <>
                  <br />
                  {addr.notes}
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-muted">{pickupAddress}</p>
          )}
        </div>
        <div>
          <p className="font-semibold">Pago</p>
          <p className="text-muted">{paymentLabel}</p>
        </div>
      </div>
    </div>
  );
}
