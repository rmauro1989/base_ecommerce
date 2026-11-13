import "server-only";
import { db } from "@/lib/db";
import { createAuth } from "./factory";
import { clearAttempts, tooManyAttempts } from "./rate-limit";
import { verifyAgainstDummy, verifyPassword } from "./password";

/** Sesión de clientes de la tienda (/cuenta). */
export const customerAuth = createAuth({
  kind: "customer",
  basePath: "/api/auth",
  cookiePrefix: "tienda",
  signInPage: "/cuenta/ingresar",
  maxAgeSeconds: 30 * 24 * 3600,
  async authorize(email, password) {
    if (tooManyAttempts(`customer:${email}`)) return null;
    const c = await db.customer.findUnique({ where: { email } });
    if (!c?.passwordHash) {
      await verifyAgainstDummy(password);
      return null;
    }
    if (!(await verifyPassword(password, c.passwordHash))) return null;
    clearAttempts(`customer:${email}`);
    return { id: c.id, email: c.email, name: c.name, kind: "customer" };
  },
});

/** Cliente con sesión iniciada o null. */
export async function getCustomerSession() {
  const session = await customerAuth.auth();
  const user = session?.user as { id?: string; kind?: string } | undefined;
  if (!user?.id || user.kind !== "customer") return null;
  return { id: user.id, email: session!.user!.email!, name: session!.user!.name ?? "" };
}
