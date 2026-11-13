import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getBaseUrl } from "@/lib/url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const base = await getBaseUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/carrito", "/checkout", "/cuenta", "/pedido", "/buscar", "/dev"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
