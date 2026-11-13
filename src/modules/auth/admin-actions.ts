"use server";

import { AuthError } from "next-auth";
import { adminAuth } from "./admin";

export async function loginAdmin(_prev: { error?: string } | null, formData: FormData) {
  try {
    await adminAuth.signIn("admin", { email: formData.get("email"), password: formData.get("password"), redirectTo: "/admin" });
    return null;
  } catch (e) {
    if (e instanceof AuthError) return { error: "Correo o contraseña incorrectos." };
    throw e;
  }
}

export async function logoutAdmin() {
  await adminAuth.signOut({ redirectTo: "/admin/ingresar" });
}
