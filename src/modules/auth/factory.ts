import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

export type SessionKind = "customer" | "admin";

export type AuthUser = { id: string; email: string; name: string; kind: SessionKind; role?: "OWNER" | "EDITOR" };

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

/**
 * Crea una instancia de Auth.js aislada (cookie y ruta propias) para clientes
 * o administradores. Sesión JWT; no requiere tablas extra.
 */
export function createAuth(opts: {
  kind: SessionKind;
  basePath: string;
  cookiePrefix: string;
  signInPage: string;
  maxAgeSeconds: number;
  authorize: (email: string, password: string) => Promise<AuthUser | null>;
}) {
  const secure = process.env.NODE_ENV === "production";
  const name = (n: string) => `${secure ? "__Secure-" : ""}${opts.cookiePrefix}.${n}`;
  const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", secure };

  const config: NextAuthConfig = {
    basePath: opts.basePath,
    trustHost: true,
    session: { strategy: "jwt", maxAge: opts.maxAgeSeconds },
    pages: { signIn: opts.signInPage },
    cookies: {
      sessionToken: { name: name("session"), options: cookieOptions },
      callbackUrl: { name: name("callback-url"), options: cookieOptions },
      csrfToken: { name: `${secure ? "__Host-" : ""}${opts.cookiePrefix}.csrf`, options: cookieOptions },
    },
    logger: {
      // Un login fallido es esperado: no se registra como error
      error(error) {
        if (error.name === "CredentialsSignin") return;
        console.error("[auth]", error);
      },
    },
    providers: [
      Credentials({
        id: opts.kind,
        credentials: { email: {}, password: {} },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) return null;
          return opts.authorize(parsed.data.email, parsed.data.password);
        },
      }),
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          const u = user as AuthUser;
          token.uid = u.id;
          token.kind = u.kind;
          token.role = u.role;
        }
        return token;
      },
      session({ session, token }) {
        session.user.id = token.uid as string;
        (session.user as unknown as AuthUser).kind = token.kind as SessionKind;
        (session.user as unknown as AuthUser).role = token.role as AuthUser["role"];
        return session;
      },
    },
  };
  return NextAuth(config);
}
