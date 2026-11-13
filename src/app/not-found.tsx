import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-sm text-muted">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold">No encontramos esta página</h1>
      <p className="mt-2 text-muted">Puede que el producto ya no esté disponible.</p>
      <ButtonLink href="/" className="mt-6">
        Volver al inicio
      </ButtonLink>
    </Container>
  );
}
