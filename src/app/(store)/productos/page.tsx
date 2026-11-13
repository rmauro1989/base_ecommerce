import type { Metadata } from "next";
import { connection } from "next/server";
import { getBaseUrl } from "@/lib/url";
import { CatalogView } from "@/modules/catalog/components/catalog-view";
import { parseCatalogParams } from "@/modules/catalog/filters";

export const metadata: Metadata = { title: "Catálogo", alternates: { canonical: "/productos" } };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = parseCatalogParams(await searchParams);
  return (
    <CatalogView
      title="Catálogo"
      breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Catálogo" }]}
      basePath="/productos"
      params={params}
      baseUrl={await getBaseUrl()}
    />
  );
}
