import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { requireAdmin } from "@/modules/auth/admin";
import { EmptyState, PageHeader, tableClasses as t } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();
  await requireAdmin();
  const q = z.string().trim().max(100).catch("").parse((await searchParams).q ?? "");
  const match = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {};

  // Clientes = cuentas registradas + compradores invitados (agrupados por correo)
  const [accounts, orderStats] = await Promise.all([
    db.customer.findMany({ where: match, orderBy: { createdAt: "desc" }, take: 500 }),
    db.order.groupBy({
      by: ["email"],
      where: { ...match, status: { notIn: ["CANCELLED"] } },
      _count: true,
      _sum: { total: true },
      _max: { createdAt: true, name: true },
      orderBy: { _max: { createdAt: "desc" } },
      take: 500,
    }),
  ]);
  const rows = new Map<string, { email: string; name: string; account: boolean; orders: number; total: number; last: Date | null }>();
  for (const o of orderStats) rows.set(o.email, { email: o.email, name: o._max.name ?? "", account: false, orders: o._count, total: o._sum.total ?? 0, last: o._max.createdAt });
  for (const c of accounts) {
    const r = rows.get(c.email);
    rows.set(c.email, { email: c.email, name: c.name, account: true, orders: r?.orders ?? 0, total: r?.total ?? 0, last: r?.last ?? null });
  }
  const list = [...rows.values()].sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));

  return (
    <>
      <PageHeader title="Clientes" description={`${list.length} cliente(s), con cuenta o que compraron como invitados.`} />
      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Nombre o correo" className="max-w-xs" />
        <button className="h-10 rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold">Buscar</button>
      </form>
      {list.length ? (
        <div className={t.wrap}>
          <table className={t.table}>
            <thead>
              <tr>
                <th className={t.th}>Cliente</th>
                <th className={t.th}>Tipo</th>
                <th className={`${t.th} text-right`}>Pedidos</th>
                <th className={`${t.th} text-right`}>Total comprado</th>
                <th className={t.th}>Última compra</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.email}>
                  <td className={t.td}>
                    <Link href={`/admin/clientes/${encodeURIComponent(c.email)}`} className="font-semibold hover:underline">
                      {c.name || c.email}
                    </Link>
                    <p className="text-xs text-muted">{c.email}</p>
                  </td>
                  <td className={t.td}>{c.account ? <Badge tone="soft">Con cuenta</Badge> : <Badge>Invitado</Badge>}</td>
                  <td className={`${t.td} text-right`}>{c.orders}</td>
                  <td className={`${t.td} text-right`}>{formatCLP(c.total)}</td>
                  <td className={t.td}>{c.last ? c.last.toLocaleDateString("es-CL", { timeZone: "America/Santiago" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>Aún no hay clientes.</EmptyState>
      )}
    </>
  );
}
