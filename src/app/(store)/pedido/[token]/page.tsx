import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { BANK_LABELS } from "@/modules/orders/labels";
import { OrderDetail } from "@/modules/orders/order-detail";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ nuevo?: string; pago?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  await connection();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) notFound();
  const order = await db.order.findUnique({ where: { publicToken: token }, include: { items: true, notes: { where: { internal: false }, orderBy: { createdAt: "desc" } } } });
  if (!order) notFound();
  const sp = await searchParams;
  const [method, settings] = await Promise.all([
    db.paymentMethodSetting.findUnique({ where: { provider: order.paymentProvider } }),
    db.storeSettings.findUnique({ where: { id: 1 } }),
  ]);
  const bank = (settings?.bankTransferInfo ?? null) as Record<string, string> | null;
  const awaitingTransfer = order.status === "PENDING_PAYMENT" && order.paymentProvider === "MANUAL_TRANSFER";
  const paymentFailed = sp.pago === "rechazado" || sp.pago === "cancelado";

  return (
    <Container className="max-w-3xl py-10">
      {sp.nuevo && !paymentFailed ? (
        <div className="mb-6">
          <h1 className="text-3xl font-bold">¡Gracias por tu compra!</h1>
          <p className="mt-2 text-muted">Te enviamos la confirmación a {order.email}. Guarda este enlace para revisar el estado de tu pedido.</p>
        </div>
      ) : (
        <h1 className="mb-6 text-3xl font-bold">Pedido #{order.number}</h1>
      )}

      {paymentFailed ? (
        <div role="alert" className="mb-6 rounded-lg border border-danger bg-surface p-4">
          <p className="font-semibold text-danger">El pago no se completó.</p>
          <p className="mt-1 text-sm text-muted">Tu pedido quedó pendiente. Puedes intentarlo nuevamente o escribirnos para ayudarte.</p>
        </div>
      ) : null}

      {awaitingTransfer ? (
        <div className="mb-6 rounded-lg border-2 border-accent bg-accent-soft p-5">
          <p className="font-display text-lg font-bold">Transfiere {formatCLP(order.total)} para confirmar tu pedido</p>
          {method?.instructions ? <p className="mt-1 text-sm">{method.instructions}</p> : null}
          {bank ? (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {Object.entries(bank)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{BANK_LABELS[k] ?? k}</dt>
                    <dd className="font-mono">{v}</dd>
                  </div>
                ))}
              <dt className="text-muted">Asunto</dt>
              <dd className="font-mono">Pedido #{order.number}</dd>
            </dl>
          ) : null}
        </div>
      ) : null}

      {order.notes.length ? (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <p className="font-semibold">Mensajes de la tienda</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {order.notes.map((n) => (
              <li key={n.id} className="whitespace-pre-line">
                {n.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <OrderDetail order={order} paymentLabel={method?.displayName ?? order.paymentProvider} pickupAddress={settings?.pickupAddress} />

      <div className="mt-8 text-center">
        <ButtonLink href="/productos" variant="outline">
          Seguir comprando
        </ButtonLink>
      </div>
    </Container>
  );
}
