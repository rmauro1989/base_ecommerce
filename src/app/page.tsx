import { connection } from "next/server";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getStoreSettings } from "@/modules/theme/server";

// Inicio provisorio: la tienda completa se construye en la etapa (c).
export default async function Home() {
  await connection();
  const s = await getStoreSettings();
  return (
    <main className="flex flex-1 items-center bg-primary text-on-primary">
      <Container className="py-24">
        <p className="font-mono text-sm uppercase tracking-widest opacity-80">En construcción</p>
        <h1 className="mt-3 text-4xl font-bold break-words sm:text-6xl">{s.storeName}</h1>
        <p className="mt-4 max-w-xl text-lg opacity-90">¿Qué vas a instalar hoy?</p>
        <div className="mt-8 flex gap-3">
          <ButtonLink href="/dev/tema" variant="accent" size="lg">
            Ver temas
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
