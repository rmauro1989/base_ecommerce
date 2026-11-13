import Link from "next/link";
import { JsonLd } from "./json-ld";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, baseUrl }: { items: Crumb[]; baseUrl?: string }) {
  return (
    <>
      <nav aria-label="Ruta" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((c, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden>/</span> : null}
              {c.href && i < items.length - 1 ? (
                <Link href={c.href} className="hover:text-text hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-text">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {baseUrl ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: c.href ? `${baseUrl}${c.href}` : undefined })),
          }}
        />
      ) : null}
    </>
  );
}
