import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { HomeEditor, type HomeSectionInput } from "@/modules/admin/appearance/home-editor";
import { PageHeader } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Contenido del inicio" };

export default async function HomeContentPage() {
  await connection();
  await requireAdmin("OWNER");
  const rows = await db.homeSection.findMany({ orderBy: { position: "asc" } });
  const initial: HomeSectionInput[] = rows.map((r) => {
    const c = (r.config ?? {}) as { limit?: number; href?: string; cta?: string };
    return { id: r.id, type: r.type, enabled: r.enabled, title: r.title, subtitle: r.subtitle, limit: c.limit ?? null, href: c.href ?? null, cta: c.cta ?? null };
  });
  return (
    <>
      <PageHeader
        title="Contenido del inicio"
        description={
          <>
            Activa, ordena y edita las secciones de la portada.{" "}
            <Link href="/" target="_blank" className="underline">
              Ver inicio ↗
            </Link>
          </>
        }
      />
      <HomeEditor initial={initial} />
    </>
  );
}
