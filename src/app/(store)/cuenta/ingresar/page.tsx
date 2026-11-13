import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Container } from "@/components/ui/container";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCustomerSession } from "@/modules/auth/customer";
import { LoginForm } from "@/modules/auth/components/customer-forms";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  await connection();
  const volver = safeRedirectPath((await searchParams).volver, "/cuenta");
  if (await getCustomerSession()) redirect(volver);
  return (
    <Container className="max-w-md py-12">
      <h1 className="mb-6 text-3xl font-bold">Ingresar</h1>
      <div className="rounded-lg border border-border bg-surface p-6">
        <LoginForm volver={volver} />
      </div>
    </Container>
  );
}
