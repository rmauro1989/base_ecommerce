import Link from "next/link";
import { Container } from "@/components/ui/container";
import { categoryHref, getCategoryTree } from "@/modules/catalog/queries";
import { getStoreSettings } from "@/modules/theme/server";

export async function StoreFooter() {
  const [s, tree] = await Promise.all([getStoreSettings(), getCategoryTree()]);
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <Container className="grid gap-8 py-10 text-sm sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-bold">{s.storeName}</p>
          {s.seoDescription ? <p className="mt-2 text-muted">{s.seoDescription}</p> : null}
        </div>
        <div>
          <p className="font-semibold">Categorías</p>
          <ul className="mt-2 space-y-1">
            {tree.map((c) => (
              <li key={c.id}>
                <Link href={categoryHref(c)} className="text-muted hover:text-text">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold">Contacto</p>
          <ul className="mt-2 space-y-1 text-muted">
            {s.contactEmail ? (
              <li>
                <a href={`mailto:${s.contactEmail}`} className="hover:text-text">
                  {s.contactEmail}
                </a>
              </li>
            ) : null}
            {s.contactPhone ? <li>{s.contactPhone}</li> : null}
            <li>
              <Link href="/cuenta" className="hover:text-text">
                Mi cuenta
              </Link>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-border py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {s.storeName}
      </div>
    </footer>
  );
}
