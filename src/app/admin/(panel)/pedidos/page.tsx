import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { requireAdmin } from "@/modules/auth/admin";
import { releaseExpiredOrders } from "@/modules/checkout/service";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/modules/orders/labels";
import { EmptyState, PageHeader, tableClasses as t } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Pedidos" };
const PAGE = 30;

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as [keyof typeof ORDER_STATUS_LABEL, ...(keyof typeof ORDER_STATUS_LABEL)[]];
const schema = z.object({
  q: z.string().trim().max(100).catch(""),
  estado: z.enum(STATUSES).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).catch(1),
});

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  await requireAdmin();
  await releaseExpiredOrders();
  const f = schema.parse(await searchParams);
  const num = Number(f.q.replace(/^#/, ""));
  const where: Prisma.OrderWhereInput = {
    ...(f.estado ? { status: f.estado } : {}),
    ...(f.q
      ? {
          OR: [
            ...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []),
            { email: { contains: f.q, mode: "insensitive" as const } },
            { name: { contains: f.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [total, orders, counts] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.pagina - 1) * PAGE, take: PAGE, include: { _count: { select: { items: true } } } }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <PageHeader title="Pedidos" description={`${total} pedido(s)`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/pedidos" className={`rounded-full px-3 py-1 text-sm ${!f.estado ? "bg-primary text-on-primary" : "border border-border-strong bg-surface"}`}>
          Todos
        </Link>
        {STATUSES.map((s) => {
          const c = counts.find((x) => x.status === s)?._count ?? 0;
          if (!c) return null;
          return (
            <Link key={s} href={`/admin/pedidos?estado=${s}`} className={`rounded-full px-3 py-1 text-sm ${f.estado === s ? "bg-primary text-on-primary" : "border border-border-strong bg-surface"}`}>
              {ORDER_STATUS_LABEL[s]} ({c})
            </Link>
          );
        })}
      </div>
      <form className="mb-4 flex gap-2">
        {f.estado ? <input type="hidden" name="estado" value={f.estado} /> : null}
        <Input name="q" defaultValue={f.q} placeholder="N° de pedido, nombre o correo" className="max-w-xs" />
        <button className="h-10 rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold">Buscar</button>
      </form>
      {orders.length ? (
        <div className={t.wrap}>
          <table className={t.table}>
            <thead>
              <tr>
                <th className={t.th}>Pedido</th>
                <th className={t.th}>Fecha</th>
                <th className={t.th}>Cliente</th>
                <th className={t.th}>Entrega</th>
                <th className={t.th}>Estado</th>
                <th className={`${t.th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className={t.td}>
                    <Link href={`/admin/pedidos/${o.id}`} className="font-semibold hover:underline">
                      #{o.number}
                    </Link>
                    <p className="text-xs text-muted">{o._count.items} ítem(s)</p>
                  </td>
                  <td className={`${t.td} whitespace-nowrap`}>{o.createdAt.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" })}</td>
                  <td className={t.td}>
                    {o.name}
                    <p className="text-xs text-muted">{o.email}</p>
                  </td>
                  <td className={t.td}>{o.fulfillment === "PICKUP" ? "Retiro" : ((o.shippingAddress as { comuna?: string } | null)?.comuna ?? "Despacho")}</td>
                  <td className={t.td}>
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </td>
                  <td className={`${t.td} text-right font-semibold`}>{formatCLP(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No hay pedidos.</EmptyState>
      )}
      {pages > 1 ? (
        <nav className="mt-4 flex justify-center gap-3 text-sm">
          {f.pagina > 1 ? <Link className="underline" href={`?${new URLSearchParams({ ...(f.q && { q: f.q }), ...(f.estado && { estado: f.estado }), pagina: String(f.pagina - 1) })}`}>← Anterior</Link> : null}
          <span className="text-muted">
            Página {f.pagina} de {pages}
          </span>
          {f.pagina < pages ? <Link className="underline" href={`?${new URLSearchParams({ ...(f.q && { q: f.q }), ...(f.estado && { estado: f.estado }), pagina: String(f.pagina + 1) })}`}>Siguiente →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
