"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <h1 className="text-3xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-muted">Ocurrió un error inesperado. Inténtalo nuevamente.</p>
      <Button onClick={reset} className="mt-6">
        Reintentar
      </Button>
    </Container>
  );
}
