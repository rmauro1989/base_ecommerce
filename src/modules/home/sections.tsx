import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SearchForm } from "@/components/store/search-form";
import { ProductImage } from "@/components/store/product-image";
import { Badge } from "@/components/ui/badge";
import { formatCLP } from "@/lib/money";
import { ProductGrid } from "@/modules/catalog/components/product-card";
import { categoryHref, getBestsellers, getCategoryTree, getFeatured, getKits } from "@/modules/catalog/queries";
import type { HomeSectionData } from "./queries";

const limitOf = (s: HomeSectionData, fallback: number) => (typeof s.config.limit === "number" ? Math.min(24, Math.max(1, s.config.limit)) : fallback);

function SectionHeading({ title, subtitle, href, linkLabel }: { title: string; subtitle?: string | null; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          {linkLabel ?? "Ver todo"} →
        </Link>
      ) : null}
    </div>
  );
}

export function HeroSection({ section }: { section: HomeSectionData }) {
  return (
    <section className="bg-primary text-on-primary">
      <Container className="py-14 sm:py-20">
        <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl lg:text-6xl">{section.title ?? "¿Qué vas a instalar hoy?"}</h1>
        {section.subtitle ? <p className="mt-4 max-w-2xl text-lg opacity-90">{section.subtitle}</p> : null}
        <SearchForm large className="mt-8 max-w-2xl" />
      </Container>
    </section>
  );
}

export async function CategoriesSection({ section }: { section: HomeSectionData }) {
  const tree = (await getCategoryTree()).filter((c) => c.productCount > 0);
  return (
    <Container className="py-12">
      <SectionHeading title={section.title ?? "Categorías"} subtitle={section.subtitle} href="/productos" linkLabel="Ver catálogo" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tree.map((c) => (
          <Link
            key={c.id}
            href={categoryHref(c)}
            className="group flex flex-col justify-between gap-6 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
          >
            <span className="font-display text-lg leading-tight font-semibold group-hover:underline">{c.name}</span>
            <span className="text-xs text-muted">
              {c.productCount} producto{c.productCount === 1 ? "" : "s"}
            </span>
          </Link>
        ))}
      </div>
    </Container>
  );
}

export async function KitsSection({ section }: { section: HomeSectionData }) {
  const kits = await getKits(limitOf(section, 6));
  if (!kits.length) return null;
  return (
    <section className="border-y border-border bg-surface">
      <Container className="py-12">
        <SectionHeading title={section.title ?? "Kits por proyecto"} subtitle={section.subtitle} href="/kits" linkLabel="Ver kits" />
        <div className="grid gap-4 md:grid-cols-2">
          {kits.map((k) => (
            <Link key={k.id} href={`/producto/${k.slug}`} className="group flex gap-4 rounded-lg border border-border bg-bg p-3 hover:border-primary">
              <ProductImage src={k.imageUrl} alt={k.imageAlt} className="w-28 shrink-0 rounded-md sm:w-36" sizes="150px" />
              <div className="flex flex-col gap-2 py-1">
                <div className="flex flex-wrap gap-1">
                  <Badge tone="accent">{k.componentCount} productos</Badge>
                  {k.kitSavingsPercent ? <Badge tone="soft">Ahorra {k.kitSavingsPercent}%</Badge> : null}
                </div>
                <h3 className="font-display text-lg leading-tight font-semibold group-hover:underline">{k.name}</h3>
                {k.shortDescription ? <p className="line-clamp-2 text-sm text-muted">{k.shortDescription}</p> : null}
                <p className="mt-auto font-display text-xl font-bold">{formatCLP(k.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

export async function BestsellersSection({ section }: { section: HomeSectionData }) {
  const products = await getBestsellers(limitOf(section, 8));
  if (!products.length) return null;
  return (
    <Container className="py-12">
      <SectionHeading title={section.title ?? "Más vendidos"} subtitle={section.subtitle} href="/productos" />
      <ProductGrid products={products} />
    </Container>
  );
}

export async function FeaturedSection({ section }: { section: HomeSectionData }) {
  const products = await getFeatured(limitOf(section, 4));
  if (!products.length) return null;
  return (
    <Container className="py-12">
      <SectionHeading title={section.title ?? "Destacados"} subtitle={section.subtitle} />
      <ProductGrid products={products} />
    </Container>
  );
}

export function BannerSection({ section }: { section: HomeSectionData }) {
  const href = typeof section.config.href === "string" && section.config.href.startsWith("/") ? section.config.href : null;
  const cta = typeof section.config.cta === "string" ? section.config.cta : "Ver más";
  return (
    <Container className="py-8">
      <div className="flex flex-col items-start gap-4 rounded-xl bg-accent p-6 text-on-accent sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          {section.title ? <h2 className="text-2xl font-bold">{section.title}</h2> : null}
          {section.subtitle ? <p className="mt-1 opacity-90">{section.subtitle}</p> : null}
        </div>
        {href ? (
          <ButtonLink href={href} variant="primary">
            {cta}
          </ButtonLink>
        ) : null}
      </div>
    </Container>
  );
}

export function HomeSection({ section }: { section: HomeSectionData }) {
  switch (section.type) {
    case "HERO":
      return <HeroSection section={section} />;
    case "CATEGORIES":
      return <CategoriesSection section={section} />;
    case "KITS":
      return <KitsSection section={section} />;
    case "BESTSELLERS":
      return <BestsellersSection section={section} />;
    case "FEATURED":
      return <FeaturedSection section={section} />;
    case "BANNER":
      return <BannerSection section={section} />;
  }
}
