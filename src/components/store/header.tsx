import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { getCustomerSession } from "@/modules/auth/customer";
import { getCartCount } from "@/modules/cart/service";
import { categoryHref, getCategoryTree } from "@/modules/catalog/queries";
import { getStoreSettings } from "@/modules/theme/server";
import { SearchForm } from "./search-form";

export async function StoreHeader() {
  const [settings, tree, cartCount, customer] = await Promise.all([getStoreSettings(), getCategoryTree(), getCartCount(), getCustomerSession()]);
  const nav = tree.filter((c) => c.productCount > 0);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="bg-primary text-on-primary">
        <Container className="flex h-14 items-center gap-3 sm:h-16 sm:gap-6">
          {/* Menú móvil sin JavaScript */}
          <details className="group relative md:hidden">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md hover:bg-primary-hover" aria-label="Menú">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav className="absolute top-11 left-0 w-64 rounded-md border border-border bg-surface p-2 text-text shadow-lg">
              {nav.map((c) => (
                <Link key={c.id} href={categoryHref(c)} className="block rounded-sm px-3 py-2 text-sm hover:bg-primary-soft">
                  {c.name}
                </Link>
              ))}
              <Link href="/kits" className="block rounded-sm px-3 py-2 text-sm font-semibold hover:bg-primary-soft">
                Kits por proyecto
              </Link>
            </nav>
          </details>

          <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold sm:text-xl">
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} alt={settings.storeName} width={160} height={40} className="h-8 w-auto sm:h-10" unoptimized />
            ) : (
              settings.storeName
            )}
          </Link>

          <SearchForm className="hidden flex-1 md:flex" />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href={customer ? "/cuenta" : "/cuenta/ingresar"} className="flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-primary-hover">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              <span className="hidden sm:inline">{customer ? customer.name.split(" ")[0] : "Ingresar"}</span>
            </Link>
            <Link href="/carrito" className="relative flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-primary-hover" aria-label={`Carro (${cartCount})`}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
                <circle cx="10" cy="20" r="1.5" />
                <circle cx="17" cy="20" r="1.5" />
              </svg>
              <span className="hidden sm:inline">Carro</span>
              {cartCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-on-accent">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </Container>
      </div>
      <Container className="py-2 md:hidden">
        <SearchForm />
      </Container>
      <Container className="hidden h-11 items-center gap-6 overflow-x-auto text-sm md:flex">
        {nav.map((c) => (
          <Link key={c.id} href={categoryHref(c)} className="shrink-0 font-medium text-muted hover:text-text">
            {c.name}
          </Link>
        ))}
        <Link href="/kits" className="shrink-0 font-semibold hover:underline">
          Kits por proyecto
        </Link>
      </Container>
    </header>
  );
}
