import { NextResponse, type NextRequest } from "next/server";

/**
 * Verificación optimista: si no hay cookie de sesión de admin, redirige al login
 * con un 307 real. La autorización completa ocurre en cada página y acción
 * (requireAdmin / adminGuard).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/ingresar") return NextResponse.next();
  const hasSession = req.cookies.has("admin.session") || req.cookies.has("__Secure-admin.session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/ingresar";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
