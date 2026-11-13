import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { formatCLP, formatNumber } from "@/lib/money";
import { requireAdmin } from "@/modules/auth/admin";
import { PageHeader, Panel, tableClasses as t } from "@/modules/admin/ui/layout-parts";
import { releaseExpiredOrders } from "@/modules/checkout/service";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/modules/orders/labels";

/** Fecha de hace N días (fuera del componente: Date.now() es impuro). */
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 3600_000);
}

const LOW_STOCK = { UNIT: 10, PACK: 3, METER: 50 } as const;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  await requireAdmin();
  await releaseExpiredOrders();
  const sp = await searchParams;
  const since = daysAgo(30);

  const [pending, toPrepare, sales30, drafts, recent, variants] = await Promise.all([
    db.order.count({ where: { status: "PENDING_PAYMENT" } }),
    db.order.count({ where: { status: { in: ["PAID", "PREPARING"] } } }),
    db.order.aggregate({ where: { status: { in: ["PAID", "PREPARING", "SHIPPED", "READY_FOR_PICKUP", "DELIVERED"] }, createdAt: { gte: since } }, _sum: { total: true }, _count: true }),
    db.product.count({ where: { status: "DRAFT" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.productVariant.findMany({
      where: { active: true, product: { status: "PUBLISHED", type: "SIMPLE" } },
      include: { product: { select: { id: true, name: true, saleUnit: true } } },
      orderBy: { stock: "asc" },
      take: 200,
    }),
  ]);
  const lowStock = variants.filter((v) => Number(v.stock) <= LOW_STOCK[v.product.saleUnit]).slice(0, 10);

  const stats = [
    { label: "Pendientes de pago", value: pending, href: "/admin/pedidos?estado=PENDING_PAYMENT" },
    { label: "Por preparar", value: toPrepare, href: "/admin/pedidos?estado=PAID" },
    { label: "Ventas (30 días)", value: formatCLP(sales30._sum.total ?? 0), sub: `${sales30._count} pedidos`, href: "/admin/pedidos" },
    { label: "Productos en borrador", value: drafts, href: "/admin/productos?estado=DRAFT" },
  ];

  return (
    <>
      <PageHeader title="Resumen" />
      {sp.error === "permiso" ? <p className="mb-4 rounded-md border border-danger p-3 text-sm text-danger">No tienes permiso para esa sección.</p> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg border border-border bg-surface p-4 hover:border-primary">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{s.value}</p>
            {s.sub ? <p className="text-xs text-muted">{s.sub}</p> : null}
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Últimos pedidos" actions={<Link href="/admin/pedidos" className="text-sm text-primary underline">Ver todos</Link>}>
          {recent.length ? (
            <div className={t.wrap}>
              <table className={t.table}>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id}>
                      <td className={t.td}>
                        <Link href={`/admin/pedidos/${o.id}`} className="font-semibold hover:underline">
                          #{o.number}
                        </Link>
                      </td>
                      <td className={t.td}>{o.name}</td>
                      <td className={t.td}>
                        <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                      </td>
                      <td className={`${t.td} text-right`}>{formatCLP(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">Aún no hay pedidos.</p>
          )}
        </Panel>

        <Panel title="Stock bajo" description="Variantes publicadas bajo el mínimo sugerido.">
          {lowStock.length ? (
            <ul className="divide-y divide-border text-sm">
              {lowStock.map((v) => (
                <li key={v.id} className="flex justify-between gap-3 py-2">
                  <Link href={`/admin/productos/${v.product.id}`} className="hover:underline">
                    {v.product.name}
                    {v.name !== "Por defecto" ? <span className="text-muted"> · {v.name}</span> : null}
                  </Link>
                  <span className={Number(v.stock) <= 0 ? "font-semibold text-danger" : ""}>
                    {formatNumber(Number(v.stock))}
                    {v.product.saleUnit === "METER" ? " m" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Todo en orden.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
