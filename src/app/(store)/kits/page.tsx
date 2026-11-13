import type { Metadata } from "next";
import { connection } from "next/server";
import { CatalogView } from "@/modules/catalog/components/catalog-view";
import { parseCatalogParams } from "@/modules/catalog/filters";

export const metadata: Metadata = {
  title: "Kits por proyecto",
  description: "Todo lo que necesitas para cada instalación, en un solo carro y con precio de kit.",
  alternates: { canonical: "/kits" },
};

export default async function KitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = parseCatalogParams(await searchParams);
  return (
    <CatalogView
      title="Kits por proyecto"
      description="Todo lo que necesitas para cada instalación, en un solo carro y con precio de kit."
      breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Kits" }]}
      basePath="/kits"
      params={params}
      type="KIT"
    />
  );
}
