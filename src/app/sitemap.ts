import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getBaseUrl } from "@/lib/url";
import { getSitemapEntries } from "@/modules/catalog/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [base, { products, categories }] = await Promise.all([getBaseUrl(), getSitemapEntries()]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/productos`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/kits`, changeFrequency: "weekly", priority: 0.7 },
    ...categories.map((c) => ({ url: `${base}${c.href}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/producto/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
