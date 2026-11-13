import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

export const HOME_TAG = "home";

export async function getHomeSections() {
  "use cache";
  cacheLife("hours");
  cacheTag(HOME_TAG);
  const rows = await db.homeSection.findMany({ where: { enabled: true }, orderBy: { position: "asc" } });
  return rows.map((r) => ({ id: r.id, type: r.type, title: r.title, subtitle: r.subtitle, config: (r.config ?? {}) as Record<string, unknown> }));
}

export type HomeSectionData = Awaited<ReturnType<typeof getHomeSections>>[number];
