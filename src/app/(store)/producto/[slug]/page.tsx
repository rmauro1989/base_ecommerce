import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { JsonLd } from "@/components/store/json-ld";
import { ProductImage } from "@/components/store/product-image";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { formatCLP, formatNumber } from "@/lib/money";
import { getBaseUrl } from "@/lib/url";
import { Gallery } from "@/modules/catalog/components/gallery";
import { ProductGrid } from "@/modules/catalog/components/product-card";
import { PurchaseBox } from "@/modules/catalog/components/purchase-box";
import { piecePrice } from "@/modules/catalog/pricing";
import { categoryHref, findCategoryBySlug, getProductBySlug } from "@/modules/catalog/queries";
import { getStoreSettings } from "@/modules/theme/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const description = p.seoDescription ?? p.shortDescription ?? undefined;
  return {
    title: p.seoTitle ?? p.name,
    description,
    alternates: { canonical: `/producto/${p.slug}` },
    openGraph: { title: p.name, description, images: p.images[0] ? [{ url: p.images[0].url }] : undefined, type: "website" },
  };
}

export default async function ProductPage({ params }: Props) {
  await connection();
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();

  const [cat, baseUrl, settings] = await Promise.all([p.categorySlug ? findCategoryBySlug(p.categorySlug) : null, getBaseUrl(), getStoreSettings()]);
  const crumbs = [
    { label: "Inicio", href: "/" },
    ...(cat ? [...cat.ancestors, cat.category].map((c) => ({ label: c.name, href: categoryHref(c) })) : []),
    { label: p.name, href: `/producto/${p.slug}` },
  ];
  const inStock = p.variants.some((v) => v.stock > 0);
  const prices = p.variants.map((v) => v.price);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.shortDescription ?? p.description ?? undefined,
    image: p.images.map((i) => (i.url.startsWith("http") ? i.url : `${baseUrl}${i.url}`)),
    sku: p.variants[0]?.sku ?? undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    category: cat?.category.name,
    additionalProperty: p.specs.map((s) => ({ "@type": "PropertyValue", name: s.label, value: s.value })),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "CLP",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: p.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${baseUrl}/producto/${p.slug}`,
      seller: { "@type": "Organization", name: settings.storeName },
      ...(p.saleUnit === "METER" ? { priceSpecification: { "@type": "UnitPriceSpecification", price: Math.min(...prices), priceCurrency: "CLP", unitCode: "MTR" } } : {}),
    },
  };

  return (
    <Container className="py-6 sm:py-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={crumbs} baseUrl={baseUrl} />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={p.images} name={p.name} />

        <div>
          <div className="flex flex-wrap gap-2">
            {p.type === "KIT" ? <Badge tone="accent">Kit · {p.kitComponents.length} productos</Badge> : null}
            {p.kitSavings?.amount ? <Badge tone="soft">Ahorras {formatCLP(p.kitSavings.amount)}</Badge> : null}
          </div>
          {p.brand ? <p className="mt-2 text-sm font-medium tracking-wide text-muted uppercase">{p.brand}</p> : null}
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{p.name}</h1>
          {p.variants[0]?.sku && p.variants.length === 1 ? <p className="mt-1 font-mono text-xs text-muted">SKU {p.variants[0].sku}</p> : null}
          {p.shortDescription ? <p className="mt-3 text-muted">{p.shortDescription}</p> : null}

          <div className="mt-6 rounded-lg border border-border bg-surface p-5">
            <PurchaseBox
              type={p.type}
              saleUnit={p.saleUnit}
              price={p.price}
              compareAtPrice={p.compareAtPrice}
              lengthPresets={p.lengthPresets}
              allowCustomLength={p.allowCustomLength}
              minLength={p.minLength}
              maxLength={p.maxLength}
              lengthStep={p.lengthStep}
              packLabel={p.packLabel}
              packContent={p.packContent}
              variants={p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, price: v.price, stock: v.stock, isDefault: v.isDefault }))}
            />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
        {p.type === "KIT" ? (
          <section>
            <h2 className="mb-4 text-2xl font-bold">Qué incluye el kit</h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {p.kitComponents.map((c) => (
                <li key={c.variantId} className="flex items-center gap-3 p-3">
                  <ProductImage src={c.imageUrl} alt="" className="w-14 shrink-0 rounded-md" sizes="56px" />
                  <div className="flex-1 text-sm">
                    <Link href={`/producto/${c.productSlug}`} className="font-semibold hover:underline">
                      {c.productName}
                    </Link>
                    {c.variantName ? <span className="text-muted"> · {c.variantName}</span> : null}
                    <p className="font-mono text-xs text-muted">{c.saleUnit === "METER" ? `${formatNumber(c.quantity)} m` : `${formatNumber(c.quantity)} un.`}</p>
                  </div>
                  <span className="text-sm text-muted">{formatCLP(c.saleUnit === "METER" ? piecePrice("METER", c.price, c.quantity) : c.price * c.quantity)}</span>
                </li>
              ))}
              {p.kitSavings ? (
                <li className="flex justify-between p-3 text-sm">
                  <span className="text-muted">Por separado</span>
                  <s className="text-muted">{formatCLP(p.kitSavings.componentsValue)}</s>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {p.specs.length ? (
          <section>
            <h2 className="mb-4 text-2xl font-bold">Ficha técnica</h2>
            <dl className="grid grid-cols-[auto_1fr] overflow-hidden rounded-lg border border-border bg-surface text-sm">
              {p.specs.map((s, i) => (
                <div key={s.key} className={`contents ${i % 2 ? "" : "[&>*]:bg-bg"}`}>
                  <dt className="px-4 py-2.5 text-muted">{s.label}</dt>
                  <dd className="px-4 py-2.5 font-mono">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {p.description ? (
          <section>
            <h2 className="mb-4 text-2xl font-bold">Descripción</h2>
            <div className="space-y-3 leading-relaxed whitespace-pre-line">{p.description}</div>
          </section>
        ) : null}
      </div>

      {p.related.length ? (
        <section className="mt-14">
          <h2 className="mb-1 text-2xl font-bold">Se conecta con</h2>
          <p className="mb-5 text-muted">Productos que normalmente se instalan junto a este.</p>
          <ProductGrid products={p.related} />
        </section>
      ) : null}
    </Container>
  );
}
