"use server";

import { AuthError } from "next-auth";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { customerAuth, getCustomerSession } from "./customer";
import { hashPassword, passwordSchema } from "./password";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | null;

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function loginCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const redirectTo = safeRedirectPath(formData.get("volver"), "/cuenta");
  try {
    await customerAuth.signIn("customer", { email: formData.get("email"), password: formData.get("password"), redirectTo });
    return null;
  } catch (e) {
    if (e instanceof AuthError) return { error: "Correo o contraseña incorrectos." };
    throw e; // redirección de éxito
  }
}

const registerSchema = z
  .object({
    name: z.string().trim().min(3, "Ingresa tu nombre completo").max(120),
    email: z.string().trim().toLowerCase().email("Correo inválido").max(150),
    phone: z.string().trim().max(20).optional(),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

export async function registerCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisa los datos marcados.", fieldErrors: fieldErrors(parsed.error) };
  const { name, email, phone, password } = parsed.data;
  const existing = await db.customer.findUnique({ where: { email } });
  if (existing) return { error: "Ya existe una cuenta con ese correo. Ingresa con tu contraseña.", fieldErrors: { email: "Ya registrado" } };
  await db.customer.create({ data: { name, email, phone: phone || null, passwordHash: await hashPassword(password) } });
  const redirectTo = safeRedirectPath(formData.get("volver"), "/cuenta");
  await customerAuth.signIn("customer", { email, password, redirectTo });
  return null;
}

export async function logoutCustomer() {
  await customerAuth.signOut({ redirectTo: "/" });
}

const profileSchema = z.object({
  name: z.string().trim().min(3, "Ingresa tu nombre completo").max(120),
  phone: z.string().trim().max(20).optional(),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getCustomerSession();
  if (!session) return { error: "Tu sesión expiró." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisa los datos.", fieldErrors: fieldErrors(parsed.error) };
  await db.customer.update({ where: { id: session.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  refresh();
  return null;
}

export async function deleteAddress(formData: FormData) {
  const session = await getCustomerSession();
  const id = z.string().min(1).max(40).safeParse(formData.get("id"));
  if (!session || !id.success) return;
  await db.address.deleteMany({ where: { id: id.data, customerId: session.id } });
  refresh();
}
