import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { requireAdmin } from "@/modules/auth/admin";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/modules/orders/labels";
import { PageHeader, Panel, tableClasses as t } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerPage({ params }: { params: Promise<{ email: string }> }) {
  await connection();
  await requireAdmin();
  const email = decodeURIComponent((await params).email).toLowerCase();
  const [customer, orders] = await Promise.all([
    db.customer.findUnique({ where: { email }, include: { addresses: true } }),
    db.order.findMany({ where: { email }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!customer && !orders.length) notFound();
  const name = customer?.name ?? orders[0]?.name ?? email;
  const paid = orders.filter((o) => !["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(o.status));

  return (
    <>
      <PageHeader
        title={name}
        description={
          <>
            <Link href="/admin/clientes" className="underline">
              ← Clientes
            </Link>{" "}
            · {email}
          </>
        }
        actions={customer ? <Badge tone="soft">Con cuenta desde {customer.createdAt.toLocaleDateString("es-CL")}</Badge> : <Badge>Invitado</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title={`Pedidos (${orders.length})`}>
          <div className={t.wrap}>
            <table className={t.table}>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className={t.td}>
                      <Link href={`/admin/pedidos/${o.id}`} className="font-semibold hover:underline">
                        #{o.number}
                      </Link>
                    </td>
                    <td className={t.td}>{o.createdAt.toLocaleDateString("es-CL", { timeZone: "America/Santiago" })}</td>
                    <td className={t.td}>
                      <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    </td>
                    <td className={`${t.td} text-right`}>{formatCLP(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="Resumen">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Pedidos pagados</dt>
              <dd>{paid.length}</dd>
              <dt className="text-muted">Total comprado</dt>
              <dd>{formatCLP(paid.reduce((s, o) => s + o.total, 0))}</dd>
              <dt className="text-muted">Teléfono</dt>
              <dd>{customer?.phone ?? orders[0]?.phone ?? "—"}</dd>
              <dt className="text-muted">RUT</dt>
              <dd>{customer?.rut ?? orders.find((o) => o.rut)?.rut ?? "—"}</dd>
            </dl>
          </Panel>
          {customer?.addresses.length ? (
            <Panel title="Direcciones guardadas">
              <ul className="flex flex-col gap-2 text-sm">
                {customer.addresses.map((a) => (
                  <li key={a.id}>
                    {a.street} {a.number}
                    {a.apartment ? `, ${a.apartment}` : ""} — {a.comuna}, {a.region}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
