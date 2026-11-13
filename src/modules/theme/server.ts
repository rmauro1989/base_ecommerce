import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { resolveTheme } from "./resolve";

export const STORE_SETTINGS_TAG = "store-settings";

/** Configuración de la tienda (cacheada; se invalida al guardar en el admin). */
export async function getStoreSettings() {
  "use cache";
  cacheLife("hours");
  cacheTag(STORE_SETTINGS_TAG);
  const s = await db.storeSettings.findUnique({
    where: { id: 1 },
    include: { logoAsset: { select: { url: true } }, faviconAsset: { select: { url: true } } },
  });
  return {
    storeName: s?.storeName ?? process.env.STORE_NAME ?? "Mi Tienda Eléctrica",
    themePreset: s?.themePreset ?? null,
    themeOverrides: (s?.themeOverrides ?? null) as unknown,
    logoUrl: s?.logoAsset?.url ?? null,
    faviconUrl: s?.faviconAsset?.url ?? null,
    contactEmail: s?.contactEmail ?? null,
    contactPhone: s?.contactPhone ?? null,
    seoDescription: s?.seoDescription ?? null,
  };
}

export async function getActiveTheme() {
  const s = await getStoreSettings();
  return resolveTheme(s.themePreset, s.themeOverrides);
}
