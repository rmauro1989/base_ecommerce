import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/modules/auth/admin";
import { logoutAdmin } from "@/modules/auth/admin-actions";
import { AdminSidebar } from "@/modules/admin/ui/sidebar";
import { getStoreSettings } from "@/modules/theme/server";

export const metadata: Metadata = { title: { default: "Panel", template: "%s · Panel" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const [admin, s] = await Promise.all([requireAdmin(), getStoreSettings()]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center gap-4 bg-primary px-4 text-on-primary">
        <Link href="/admin" className="font-display font-bold">
          {s.storeName} <span className="font-normal opacity-80">· Panel</span>
        </Link>
        <Link href="/" target="_blank" className="hidden text-sm underline opacity-90 sm:inline">
          Ver tienda ↗
        </Link>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">
            {admin.name} · {admin.role === "OWNER" ? "Dueño" : "Editor"}
          </span>
          <form action={logoutAdmin}>
            <Button type="submit" variant="accent" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <AdminSidebar role={admin.role} />
        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
