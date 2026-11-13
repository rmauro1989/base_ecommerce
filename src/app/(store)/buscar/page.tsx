import type { Metadata } from "next";
import { connection } from "next/server";
import { CatalogView } from "@/modules/catalog/components/catalog-view";
import { parseCatalogParams } from "@/modules/catalog/filters";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = parseCatalogParams(await searchParams);
  return { title: q ? `Resultados para “${q}”` : "Buscar", robots: { index: false } };
}

export default async function SearchPage({ searchParams }: Props) {
  await connection();
  const params = parseCatalogParams(await searchParams);
  return (
    <CatalogView
      title={params.q ? `Resultados para “${params.q}”` : "Buscar productos"}
      breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Búsqueda" }]}
      basePath="/buscar"
      params={params}
    />
  );
}
