import Link from "next/link";
import { Breadcrumbs, type Crumb } from "@/components/store/breadcrumbs";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";
import { catalogQueryString, toggleAttrValue, type CatalogParams } from "../filters";
import { categoryHref, getFacets, listProducts, type CategoryNode, type Facet } from "../queries";
import { ProductGrid } from "./product-card";
import { SortSelect } from "./sort-select";

type Props = {
  title: string;
  description?: string | null;
  breadcrumbs: Crumb[];
  basePath: string;
  params: CatalogParams;
  categoryIds?: string[];
  categoryChain?: string[];
  subcategories?: CategoryNode[];
  type?: "KIT";
  baseUrl?: string;
};

function FacetList({ facets, params, basePath }: { facets: Facet[]; params: CatalogParams; basePath: string }) {
  if (!facets.length) return <p className="text-sm text-muted">No hay filtros para esta selección.</p>;
  return (
    <div className="flex flex-col gap-6">
      {facets.map((f) => (
        <fieldset key={f.key}>
          <legend className="mb-2 text-sm font-semibold">{f.label}</legend>
          <ul className="flex flex-col gap-1">
            {f.values.map((v) => {
              const active = params.attrs[f.key]?.includes(v.value) ?? false;
              const href = basePath + catalogQueryString({ ...params, page: 1, attrs: toggleAttrValue(params.attrs, f.key, v.value) });
              return (
                <li key={v.value}>
                  <Link href={href} scroll={false} className="group flex items-center gap-2 py-0.5 text-sm" aria-current={active ? "true" : undefined} rel="nofollow">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                        active ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface group-hover:border-primary",
                      )}
                    >
                      {active ? (
                        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M3 8.5l3 3 7-7" />
                        </svg>
                      ) : null}
                    </span>
                    <span className={active ? "font-semibold" : ""}>{v.label}</span>
                    <span className="ml-auto text-xs text-muted">{v.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

function Pagination({ page, pages, params, basePath }: { page: number; pages: number; params: CatalogParams; basePath: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => basePath + catalogQueryString({ ...params, page: p });
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1);
  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-md px-3 py-2 text-sm hover:bg-primary-soft" rel="prev">
          ← Anterior
        </Link>
      ) : null}
      {nums.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - nums[i - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn("flex size-9 items-center justify-center rounded-md text-sm", p === page ? "bg-primary text-on-primary" : "hover:bg-primary-soft")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link href={href(page + 1)} className="rounded-md px-3 py-2 text-sm hover:bg-primary-soft" rel="next">
          Siguiente →
        </Link>
      ) : null}
    </nav>
  );
}

export async function CatalogView(props: Props) {
  const { params, basePath } = props;
  const [result, facets] = await Promise.all([
    listProducts({ ...params, categoryIds: props.categoryIds, type: props.type }),
    getFacets({ q: params.q, categoryIds: props.categoryIds, categoryChain: props.categoryChain }),
  ]);
  const activeFilters = Object.entries(params.attrs).flatMap(([key, values]) => {
    const facet = facets.find((f) => f.key === key);
    return values.map((v) => ({ key, value: v, label: `${facet?.label ?? key}: ${facet?.values.find((x) => x.value === v)?.label ?? v}` }));
  });

  return (
    <Container className="py-6 sm:py-8">
      <Breadcrumbs items={props.breadcrumbs} baseUrl={props.baseUrl} />
      <div className="mt-3 mb-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{props.title}</h1>
        {props.description ? <p className="mt-2 max-w-3xl text-muted">{props.description}</p> : null}
      </div>

      {props.subcategories?.length ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {props.subcategories.map((c) => (
            <Link key={c.id} href={categoryHref(c)} className="rounded-full border border-border-strong bg-surface px-4 py-1.5 text-sm font-medium hover:border-primary">
              {c.name} <span className="text-muted">({c.productCount})</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <p className="mb-4 font-display text-lg font-semibold">Filtrar</p>
          <FacetList facets={facets} params={params} basePath={basePath} />
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {result.total} producto{result.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <details className="relative lg:hidden">
                <summary className="flex h-9 cursor-pointer list-none items-center rounded-md border border-border-strong bg-surface px-3 text-sm">
                  Filtros{activeFilters.length ? ` (${activeFilters.length})` : ""}
                </summary>
                <div className="absolute right-0 z-20 mt-2 max-h-[70vh] w-72 overflow-auto rounded-md border border-border bg-surface p-4 shadow-lg">
                  <FacetList facets={facets} params={params} basePath={basePath} />
                </div>
              </details>
              <SortSelect value={params.sort} />
            </div>
          </div>

          {activeFilters.length ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <Link
                  key={`${f.key}-${f.value}`}
                  href={basePath + catalogQueryString({ ...params, page: 1, attrs: toggleAttrValue(params.attrs, f.key, f.value) })}
                  className="flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium hover:underline"
                  rel="nofollow"
                >
                  {f.label} <span aria-label="Quitar">×</span>
                </Link>
              ))}
              <Link href={basePath + catalogQueryString({ q: params.q, sort: params.sort })} className="text-xs text-primary underline">
                Limpiar filtros
              </Link>
            </div>
          ) : null}

          {result.items.length ? (
            <ProductGrid products={result.items} />
          ) : (
            <div className="rounded-lg border border-dashed border-border-strong p-10 text-center">
              <p className="font-semibold">No encontramos productos con esos criterios.</p>
              <p className="mt-1 text-sm text-muted">Prueba quitando filtros o con otra búsqueda.</p>
            </div>
          )}
          <Pagination page={params.page} pages={result.pages} params={params} basePath={basePath} />
        </div>
      </div>
    </Container>
  );
}
