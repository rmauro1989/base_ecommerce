import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAdminSession } from "@/modules/auth/admin";
import { AdminLoginForm } from "@/modules/admin/ui/login-form";
import { getStoreSettings } from "@/modules/theme/server";

export const metadata: Metadata = { title: "Panel · Ingresar", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  await connection();
  if (await getAdminSession()) redirect("/admin");
  const s = await getStoreSettings();
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6">
        <p className="font-display text-xl font-bold">{s.storeName}</p>
        <p className="mb-6 text-sm text-muted">Panel de administración</p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
