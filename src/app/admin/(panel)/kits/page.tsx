import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { requireAdmin } from "@/modules/auth/admin";
import { kitAvailableStock, kitSavings } from "@/modules/catalog/pricing";
import { EmptyState, PageHeader, tableClasses as t } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Kits" };

export default async function AdminKitsPage() {
  await connection();
  await requireAdmin();
  const kits = await db.product.findMany({
    where: { type: "KIT", status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    include: { kitItems: { include: { variant: { include: { product: { select: { price: true, saleUnit: true } } } } } } },
  });
  return (
    <>
      <PageHeader
        title="Kits"
        description="Productos compuestos con precio de kit. Su stock depende de los componentes."
        actions={<ButtonLink href="/admin/productos/nuevo?tipo=kit">Nuevo kit</ButtonLink>}
      />
      {kits.length ? (
        <div className={t.wrap}>
          <table className={t.table}>
            <thead>
              <tr>
                <th className={t.th}>Kit</th>
                <th className={t.th}>Componentes</th>
                <th className={`${t.th} text-right`}>Precio</th>
                <th className={`${t.th} text-right`}>Ahorro</th>
                <th className={`${t.th} text-right`}>Disponibles</th>
                <th className={t.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {kits.map((k) => {
                const items = k.kitItems.map((i) => ({
                  saleUnit: i.variant.product.saleUnit,
                  price: i.variant.priceOverride ?? i.variant.product.price,
                  quantity: Number(i.quantity),
                  stock: Number(i.variant.stock),
                }));
                const s = kitSavings(k.price, items);
                return (
                  <tr key={k.id}>
                    <td className={t.td}>
                      <Link href={`/admin/productos/${k.id}`} className="font-semibold hover:underline">
                        {k.name}
                      </Link>
                    </td>
                    <td className={t.td}>{k.kitItems.length}</td>
                    <td className={`${t.td} text-right`}>{formatCLP(k.price)}</td>
                    <td className={`${t.td} text-right`}>{s.amount > 0 ? `${s.percent}%` : <span className="text-danger">sin ahorro</span>}</td>
                    <td className={`${t.td} text-right font-mono`}>{kitAvailableStock(items)}</td>
                    <td className={t.td}>
                      <Badge tone={k.status === "PUBLISHED" ? "success" : "neutral"}>{k.status === "PUBLISHED" ? "Publicado" : "Borrador"}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>Aún no hay kits.</EmptyState>
      )}
    </>
  );
}
