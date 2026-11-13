import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { getCustomerSession } from "@/modules/auth/customer";
import { deleteAddress, logoutCustomer } from "@/modules/auth/customer-actions";
import { ProfileForm } from "@/modules/auth/components/customer-forms";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/modules/orders/labels";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

export default async function AccountPage() {
  await connection();
  const session = await getCustomerSession();
  if (!session) redirect("/cuenta/ingresar");
  const customer = await db.customer.findUnique({
    where: { id: session.id },
    include: { orders: { orderBy: { createdAt: "desc" }, take: 50 }, addresses: { orderBy: { createdAt: "desc" } } },
  });
  if (!customer) redirect("/cuenta/ingresar");

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hola, {customer.name.split(" ")[0]}</h1>
          <p className="text-muted">{customer.email}</p>
        </div>
        <form action={logoutCustomer}>
          <Button type="submit" variant="outline" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-4 text-xl font-bold">Mis pedidos</h2>
          {customer.orders.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {customer.orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/pedido/${o.publicToken}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-primary-soft">
                    <div>
                      <p className="font-semibold">Pedido #{o.number}</p>
                      <p className="text-xs text-muted">{o.createdAt.toLocaleDateString("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" })}</p>
                    </div>
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    <span className="font-display font-bold">{formatCLP(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-muted">Aún no tienes pedidos.</p>
          )}
        </section>

        <aside className="flex flex-col gap-8">
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-lg font-bold">Mis datos</h2>
            <ProfileForm name={customer.name} phone={customer.phone} />
          </section>
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-lg font-bold">Direcciones</h2>
            {customer.addresses.length ? (
              <ul className="flex flex-col gap-3 text-sm">
                {customer.addresses.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span>
                      {a.street} {a.number}
                      {a.apartment ? `, ${a.apartment}` : ""}
                      <br />
                      <span className="text-muted">
                        {a.comuna}, {a.region}
                      </span>
                    </span>
                    <form action={deleteAddress}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-xs text-muted underline hover:text-danger">Eliminar</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Se guardan al comprar con despacho.</p>
            )}
          </section>
        </aside>
      </div>
    </Container>
  );
}
