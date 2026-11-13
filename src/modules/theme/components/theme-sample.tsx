import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

/** Muestra de la interfaz con el tema activo del contenedor (usada en vista previa). */
export function ThemeSample({ storeName = "Tienda Eléctrica" }: { storeName?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between rounded-md bg-primary px-4 py-3 text-on-primary">
        <span className="font-display text-lg font-bold">{storeName}</span>
        <span className="text-sm opacity-90">Carro (2)</span>
      </header>

      <section className="rounded-lg bg-surface p-5">
        <h2 className="font-display text-2xl font-bold">¿Qué vas a instalar hoy?</h2>
        <p className="mt-1 text-sm text-muted">Busca por producto, código o proyecto.</p>
        <div className="mt-3 flex gap-2">
          <Input placeholder="Ej: cable 2,5 mm²" aria-label="Buscar" />
          <Button>Buscar</Button>
        </div>
      </section>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone="accent">Más vendido</Badge>
            <h3 className="mt-2 font-display text-lg font-semibold">Cable THHN 2,5 mm²</h3>
            <p className="text-sm text-muted">Cobre · 600 V · por metro</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold">$690</p>
            <p className="text-xs text-muted">por metro</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-xs">
          <dt className="text-muted">Sección</dt>
          <dd>2,5 mm²</dd>
          <dt className="text-muted">Voltaje</dt>
          <dd>600 V</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" size="sm">Agregar al carro</Button>
          <Button variant="accent" size="sm">Comprar kit</Button>
          <Button variant="outline" size="sm">Ficha técnica</Button>
          <Button variant="ghost" size="sm">Ver más</Button>
        </div>
      </Card>

      <Card className="p-4">
        <Field label="Comuna" hint="Calculamos el despacho según tu comuna." htmlFor="comuna-demo">
          <Input id="comuna-demo" defaultValue="Ñuñoa" />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>Neutro</Badge>
          <Badge tone="soft">Suave</Badge>
          <Badge tone="primary">Primario</Badge>
          <Badge tone="success">En stock</Badge>
          <Badge tone="danger">Sin stock</Badge>
        </div>
        <p className="mt-3 text-sm">
          Texto normal con un <a className="font-semibold text-primary underline" href="#">enlace</a>.
        </p>
      </Card>
    </div>
  );
}
