import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ProductImage } from "@/components/store/product-image";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { formatCLP, formatNumber } from "@/lib/money";
import { removeCartItem, updateCartItem } from "@/modules/cart/actions";
import { getCart } from "@/modules/cart/service";
import { MAX_QUANTITY } from "@/modules/catalog/pricing";

export const metadata: Metadata = { title: "Carro", robots: { index: false } };

export default async function CartPage() {
  await connection();
  const cart = await getCart();

  if (!cart.lines.length) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-3xl font-bold">Tu carro está vacío</h1>
        <p className="mt-2 text-muted">Busca lo que necesitas para tu instalación.</p>
        <ButtonLink href="/productos" className="mt-6">
          Ver catálogo
        </ButtonLink>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <h1 className="text-3xl font-bold">Carro</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex gap-3 p-4 sm:gap-4">
              <ProductImage src={l.imageUrl} alt="" className="w-20 shrink-0 rounded-md sm:w-24" sizes="96px" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link href={`/producto/${l.productSlug}`} className="font-semibold hover:underline">
                  {l.name}
                </Link>
                <p className="text-sm text-muted">
                  {[l.variantName, l.saleUnit === "METER" && l.length ? `${formatNumber(l.length)} m por pieza` : null, l.saleUnit === "PACK" ? l.packLabel : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs text-muted">
                  {formatCLP(l.piecePrice)} {l.saleUnit === "METER" ? `(${formatCLP(l.unitPrice)}/m)` : "c/u"}
                </p>
                {l.problem ? <p className="text-sm font-medium text-danger">{l.problem}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex h-9 items-center rounded-md border border-border-strong">
                    <form action={updateCartItem}>
                      <input type="hidden" name="itemId" value={l.id} />
                      <input type="hidden" name="quantity" value={l.quantity - 1} />
                      <button className="h-9 px-3" aria-label="Restar uno">
                        −
                      </button>
                    </form>
                    <span className="w-8 text-center font-mono text-sm">{l.quantity}</span>
                    <form action={updateCartItem}>
                      <input type="hidden" name="itemId" value={l.id} />
                      <input type="hidden" name="quantity" value={Math.min(MAX_QUANTITY, l.quantity + 1)} />
                      <button className="h-9 px-3" aria-label="Sumar uno">
                        +
                      </button>
                    </form>
                  </div>
                  <form action={removeCartItem}>
                    <input type="hidden" name="itemId" value={l.id} />
                    <button className="text-sm text-muted underline hover:text-text">Quitar</button>
                  </form>
                </div>
              </div>
              <p className="shrink-0 font-display font-bold">{formatCLP(l.lineTotal)}</p>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-36">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span className="font-display text-xl font-bold">{formatCLP(cart.subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">El despacho se calcula en el siguiente paso según tu comuna.</p>
          {cart.hasProblems ? (
            <p className="mt-4 text-sm text-danger">Corrige los productos marcados para continuar.</p>
          ) : (
            <ButtonLink href="/checkout" size="lg" className="mt-5 w-full">
              Continuar con la compra
            </ButtonLink>
          )}
          <Link href="/productos" className="mt-3 block text-center text-sm text-muted underline">
            Seguir comprando
          </Link>
        </aside>
      </div>
    </Container>
  );
}
