import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { getBaseUrl } from "@/lib/url";
import { CatalogView } from "@/modules/catalog/components/catalog-view";
import { parseCatalogParams } from "@/modules/catalog/filters";
import { categoryHref, findCategoryBySlug } from "@/modules/catalog/queries";

type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await findCategoryBySlug(slug.at(-1)!);
  if (!found) return {};
  return {
    title: found.category.name,
    description: found.category.description ?? undefined,
    alternates: { canonical: categoryHref(found.category) },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  await connection();
  const { slug } = await params;
  const found = await findCategoryBySlug(slug.at(-1)!);
  if (!found) notFound();
  const { category, ancestors, descendantIds } = found;
  // URL canónica con la ruta completa de categorías
  if (slug.join("/") !== category.path.join("/")) permanentRedirect(categoryHref(category));

  const sp = await searchParams;
  return (
    <CatalogView
      title={category.name}
      description={category.description}
      breadcrumbs={[{ label: "Inicio", href: "/" }, ...ancestors.map((a) => ({ label: a.name, href: categoryHref(a) })), { label: category.name, href: categoryHref(category) }]}
      basePath={categoryHref(category)}
      params={parseCatalogParams(sp)}
      categoryIds={descendantIds}
      categoryChain={[...ancestors.map((a) => a.id), category.id, ...descendantIds]}
      subcategories={category.children.filter((c) => c.productCount > 0)}
      baseUrl={await getBaseUrl()}
    />
  );
}
