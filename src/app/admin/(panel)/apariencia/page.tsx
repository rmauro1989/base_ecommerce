import type { Metadata } from "next";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { AppearanceEditor } from "@/modules/admin/appearance/appearance-editor";
import { PageHeader } from "@/modules/admin/ui/layout-parts";
import { defaultPreset, isPresetKey, resolveTheme } from "@/modules/theme/resolve";

export const metadata: Metadata = { title: "Apariencia" };

export default async function AppearancePage() {
  await connection();
  await requireAdmin("OWNER");
  const s = await db.storeSettings.findUniqueOrThrow({ where: { id: 1 }, include: { logoAsset: true, faviconAsset: true } });
  return (
    <>
      <PageHeader title="Apariencia" description="Colores, tipografías, logo y datos de la tienda. Los cambios se aplican a toda la tienda al guardar." />
      <AppearanceEditor
        storeName={s.storeName}
        contactEmail={s.contactEmail ?? ""}
        contactPhone={s.contactPhone ?? ""}
        seoDescription={s.seoDescription ?? ""}
        preset={isPresetKey(s.themePreset) ? s.themePreset : defaultPreset}
        tokens={resolveTheme(s.themePreset, s.themeOverrides)}
        logo={s.logoAsset ? { id: s.logoAsset.id, url: s.logoAsset.url } : null}
        favicon={s.faviconAsset ? { id: s.faviconAsset.id, url: s.faviconAsset.url } : null}
      />
    </>
  );
}
