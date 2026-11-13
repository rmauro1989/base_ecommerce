import "server-only";
import { z } from "zod";
import { getAdminSession, type AdminSession } from "@/modules/auth/admin";

export type ActionResult = { ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null;

export class ForbiddenError extends Error {}

/** Toda server action del admin parte con esto: valida sesión y rol contra la base. */
export async function adminGuard(role?: "OWNER"): Promise<AdminSession> {
  const admin = await getAdminSession();
  if (!admin) throw new ForbiddenError("Tu sesión expiró. Vuelve a ingresar.");
  if (role === "OWNER" && admin.role !== "OWNER") throw new ForbiddenError("Solo el dueño puede hacer esto.");
  return admin;
}

export function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".")] ??= i.message;
  return out;
}

export function invalid(error: z.ZodError): ActionResult {
  return { ok: false, message: "Revisa los campos marcados.", fieldErrors: zodErrors(error) };
}

/** Convierte errores conocidos en mensajes para el formulario. */
export function failure(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, message: e.message };
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return { ok: false, message: "Ya existe un registro con ese valor único (slug, SKU o correo)." };
  }
  console.error("[admin]", e);
  return { ok: false, message: "Ocurrió un error inesperado." };
}
