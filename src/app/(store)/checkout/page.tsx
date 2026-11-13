import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Container } from "@/components/ui/container";
import { db } from "@/lib/db";
import { formatCLP, formatNumber } from "@/lib/money";
import { getCustomerSession } from "@/modules/auth/customer";
import { getCart } from "@/modules/cart/service";
import { CheckoutForm } from "@/modules/checkout/components/checkout-form";
import { getAvailablePaymentMethods } from "@/modules/payments/registry";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function CheckoutPage() {
  await connection();
  const cart = await getCart();
  if (!cart.lines.length || cart.hasProblems) redirect("/carrito");

  const session = await getCustomerSession();
  const [customer, settings, paymentMethods] = await Promise.all([
    session ? db.customer.findUnique({ where: { id: session.id }, include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] } } }) : null,
    db.storeSettings.findUnique({ where: { id: 1 } }),
    getAvailablePaymentMethods(),
  ]);

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-bold">Finalizar compra</h1>
      {!customer ? (
        <p className="mt-2 text-sm text-muted">
          Compras como invitado.{" "}
          <Link href="/cuenta/ingresar?volver=/checkout" className="font-semibold text-primary underline">
            Ingresa a tu cuenta
          </Link>{" "}
          para ver tus pedidos y guardar direcciones.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">Comprando como {customer.email}.</p>
      )}

      <details className="mt-6 rounded-lg border border-border bg-surface p-4 lg:hidden">
        <summary className="cursor-pointer font-semibold">
          Ver productos ({cart.itemCount}) · {formatCLP(cart.subtotal)}
        </summary>
        <CartSummaryList lines={cart.lines} />
      </details>

      <div className="mt-6">
        <CheckoutForm
          subtotal={cart.subtotal}
          customer={customer ? { email: customer.email, name: customer.name, phone: customer.phone, rut: customer.rut } : null}
          addresses={customer?.addresses ?? []}
          paymentMethods={paymentMethods}
          pickup={{ enabled: settings?.pickupEnabled ?? false, address: settings?.pickupAddress ?? null, instructions: settings?.pickupInstructions ?? null }}
        />
      </div>

      <div className="mt-8 hidden rounded-lg border border-border bg-surface p-5 lg:block">
        <h2 className="font-semibold">Productos ({cart.itemCount})</h2>
        <CartSummaryList lines={cart.lines} />
      </div>
    </Container>
  );
}

function CartSummaryList({ lines }: { lines: Awaited<ReturnType<typeof getCart>>["lines"] }) {
  return (
    <ul className="mt-3 divide-y divide-border text-sm">
      {lines.map((l) => (
        <li key={l.id} className="flex justify-between gap-4 py-2">
          <span>
            {l.saleUnit === "METER" && l.length ? `${l.quantity} × ${formatNumber(l.length)} m` : `${l.quantity} ×`} {l.name}
            {l.variantName ? <span className="text-muted"> · {l.variantName}</span> : null}
          </span>
          <span className="shrink-0">{formatCLP(l.lineTotal)}</span>
        </li>
      ))}
    </ul>
  );
}
