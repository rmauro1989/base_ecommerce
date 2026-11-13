import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Select, Textarea } from "@/components/ui/field";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { requireAdmin } from "@/modules/auth/admin";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/modules/orders/labels";
import { OrderDetail } from "@/modules/orders/order-detail";
import { ORDER_TRANSITIONS } from "@/modules/orders/transitions";
import { addNoteAction, changeStatusAction } from "@/modules/admin/orders/actions";
import { ActionForm, FormField } from "@/modules/admin/ui/action-form";
import { SubmitButton } from "@/modules/admin/ui/kit";
import { PageHeader, Panel } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Pedido" };

const PAYMENT_STATUS = { PENDING: "Pendiente", AUTHORIZED: "Pagado", FAILED: "Rechazado", CANCELLED: "Cancelado", REFUNDED: "Reembolsado" } as const;
const fmt = (d: Date) => d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" });

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireAdmin();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, payments: { orderBy: { createdAt: "asc" } }, events: { orderBy: { createdAt: "asc" } }, notes: { orderBy: { createdAt: "desc" } }, customer: true },
  });
  if (!order) notFound();
  const [method, settings, admins] = await Promise.all([
    db.paymentMethodSetting.findUnique({ where: { provider: order.paymentProvider } }),
    db.storeSettings.findUnique({ where: { id: 1 } }),
    db.adminUser.findMany({ select: { id: true, name: true } }),
  ]);
  const adminName = (aid: string | null) => admins.find((a) => a.id === aid)?.name ?? "Sistema";
  const next = ORDER_TRANSITIONS[order.status];

  return (
    <>
      <PageHeader
        title={`Pedido #${order.number}`}
        description={
          <>
            <Link href="/admin/pedidos" className="underline">
              ← Pedidos
            </Link>{" "}
            · {fmt(order.createdAt)}
          </>
        }
        actions={<Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <OrderDetail order={order} paymentLabel={method?.displayName ?? order.paymentProvider} pickupAddress={settings?.pickupAddress} />

          <Panel title="Cliente">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Nombre</dt>
              <dd>{order.name}</dd>
              <dt className="text-muted">Correo</dt>
              <dd>
                <a href={`mailto:${order.email}`} className="underline">
                  {order.email}
                </a>
              </dd>
              <dt className="text-muted">Teléfono</dt>
              <dd>
                <a href={`tel:${order.phone}`} className="underline">
                  {order.phone}
                </a>
              </dd>
              {order.rut ? (
                <>
                  <dt className="text-muted">RUT</dt>
                  <dd>{order.rut}</dd>
                </>
              ) : null}
              <dt className="text-muted">Tipo</dt>
              <dd>{order.customer ? "Cliente con cuenta" : "Invitado"}</dd>
            </dl>
            {order.customerNotes ? <p className="mt-3 rounded-md bg-accent-soft p-3 text-sm">“{order.customerNotes}”</p> : null}
            <Link href={`/admin/clientes/${encodeURIComponent(order.email)}`} className="mt-3 inline-block text-sm text-primary underline">
              Ver historial del cliente
            </Link>
          </Panel>

          <Panel title="Pagos">
            <ul className="divide-y divide-border text-sm">
              {order.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {p.provider} · {PAYMENT_STATUS[p.status]}
                    {p.externalId ? <span className="block font-mono text-xs text-muted">{p.externalId}</span> : null}
                  </span>
                  <span>{formatCLP(p.amount)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Cambiar estado">
            {next.length ? (
              <ActionForm action={changeStatusAction} className="flex flex-col gap-3">
                <input type="hidden" name="orderId" value={order.id} />
                <FormField name="to" label="Nuevo estado">
                  <Select id="to" name="to" defaultValue={next[0]}>
                    {next.map((s) => (
                      <option key={s} value={s}>
                        {ORDER_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField name="comment" label="Comentario (opcional)" hint="Ej: N° de seguimiento del courier.">
                  <Textarea id="comment" name="comment" rows={2} />
                </FormField>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notify" defaultChecked /> Avisar al cliente por correo
                </label>
                {order.status === "PENDING_PAYMENT" && order.paymentProvider === "MANUAL_TRANSFER" ? (
                  <p className="text-xs text-muted">Marca como “Pagado” cuando confirmes la transferencia de {formatCLP(order.total)}.</p>
                ) : null}
                <p className="text-xs text-muted">Cancelar o reembolsar antes del despacho repone el stock automáticamente.</p>
                <SubmitButton>Cambiar estado</SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">Este pedido está cerrado.</p>
            )}
          </Panel>

          <Panel title="Historial">
            <ol className="flex flex-col gap-2 text-sm">
              {order.events.map((e) => (
                <li key={e.id} className="border-l-2 border-border pl-3">
                  <p>
                    <strong>{ORDER_STATUS_LABEL[e.to]}</strong> <span className="text-xs text-muted">· {fmt(e.createdAt)} · {e.adminUserId ? adminName(e.adminUserId) : "Sistema"}</span>
                  </p>
                  {e.comment ? <p className="text-muted">{e.comment}</p> : null}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Notas">
            <ActionForm action={addNoteAction} className="flex flex-col gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <FormField name="body" label="Nueva nota">
                <Textarea id="body" name="body" rows={2} />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="visible" /> Visible para el cliente en la página del pedido
              </label>
              <SubmitButton variant="outline">Agregar nota</SubmitButton>
            </ActionForm>
            {order.notes.length ? (
              <ul className="mt-4 flex flex-col gap-3 text-sm">
                {order.notes.map((n) => (
                  <li key={n.id} className="rounded-md bg-bg p-3">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {adminName(n.authorId)} · {fmt(n.createdAt)} · {n.internal ? "Interna" : "Visible al cliente"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
