import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createAuth } from "./factory";
import { clearAttempts, tooManyAttempts } from "./rate-limit";
import { verifyAgainstDummy, verifyPassword } from "./password";

/** Sesión del panel de administración (/admin), separada de la de clientes. */
export const adminAuth = createAuth({
  kind: "admin",
  basePath: "/api/admin-auth",
  cookiePrefix: "admin",
  signInPage: "/admin/ingresar",
  maxAgeSeconds: 12 * 3600,
  async authorize(email, password) {
    if (tooManyAttempts(`admin:${email}`, 5)) return null;
    const u = await db.adminUser.findUnique({ where: { email } });
    if (!u || !u.active) {
      await verifyAgainstDummy(password);
      return null;
    }
    if (!(await verifyPassword(password, u.passwordHash))) return null;
    clearAttempts(`admin:${email}`);
    return { id: u.id, email: u.email, name: u.name, kind: "admin", role: u.role };
  },
});

export type AdminSession = { id: string; email: string; name: string; role: "OWNER" | "EDITOR" };

/** Admin activo (revalidado contra la base: si lo desactivan, pierde acceso). */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await adminAuth.auth();
  const user = session?.user as { id?: string; kind?: string } | undefined;
  if (!user?.id || user.kind !== "admin") return null;
  const u = await db.adminUser.findUnique({ where: { id: user.id } });
  if (!u || !u.active) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function requireAdmin(role?: "OWNER"): Promise<AdminSession> {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/ingresar");
  if (role === "OWNER" && admin.role !== "OWNER") redirect("/admin?error=permiso");
  return admin;
}
