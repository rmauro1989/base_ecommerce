import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Container } from "@/components/ui/container";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCustomerSession } from "@/modules/auth/customer";
import { RegisterForm } from "@/modules/auth/components/customer-forms";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  await connection();
  const volver = safeRedirectPath((await searchParams).volver, "/cuenta");
  if (await getCustomerSession()) redirect(volver);
  return (
    <Container className="max-w-md py-12">
      <h1 className="mb-2 text-3xl font-bold">Crear cuenta</h1>
      <p className="mb-6 text-muted">Revisa tus pedidos y guarda tus direcciones para comprar más rápido.</p>
      <div className="rounded-lg border border-border bg-surface p-6">
        <RegisterForm volver={volver} />
      </div>
    </Container>
  );
}
