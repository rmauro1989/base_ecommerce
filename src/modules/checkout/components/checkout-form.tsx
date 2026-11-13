"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { REGIONES } from "@/lib/chile";
import { cn } from "@/lib/cn";
import { formatCLP } from "@/lib/money";
import { getShippingQuote, submitCheckout, type CheckoutState } from "../actions";
import type { ShippingQuote } from "../service";

type Address = { id: string; region: string; comuna: string; street: string; number: string; apartment: string | null; notes: string | null };

type Props = {
  subtotal: number;
  customer: { email: string; name: string; phone: string | null; rut: string | null } | null;
  addresses: Address[];
  paymentMethods: { id: string; label: string; instructions: string | null; mode: "test" | "production" }[];
  pickup: { enabled: boolean; address: string | null; instructions: string | null };
};

function Choice({ name, value, checked, onChange, title, children }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; children?: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer gap-3 rounded-md border p-3", checked ? "border-primary bg-primary-soft" : "border-border-strong bg-surface")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 accent-primary" />
      <span className="flex flex-col">
        <span className="font-semibold">{title}</span>
        {children ? <span className="text-sm text-muted">{children}</span> : null}
      </span>
    </label>
  );
}

export function CheckoutForm({ subtotal, customer, addresses, paymentMethods, pickup }: Props) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(submitCheckout, null);
  const def = addresses[0];
  const [fulfillment, setFulfillment] = useState<"SHIPPING" | "PICKUP">("SHIPPING");
  const [region, setRegion] = useState(def?.region ?? "Metropolitana de Santiago");
  const [comuna, setComuna] = useState(def?.comuna ?? "");
  const [payment, setPayment] = useState(paymentMethods[0]?.id ?? "");
  const [quote, setQuote] = useState<ShippingQuote | null | undefined>(undefined);
  const [quoting, startQuote] = useTransition();
  const postRef = useRef<HTMLFormElement>(null);
  const err = state?.fieldErrors ?? {};

  useEffect(() => {
    if (fulfillment !== "SHIPPING" || !comuna) return;
    startQuote(async () => setQuote(await getShippingQuote(comuna)));
  }, [comuna, fulfillment]);

  // Pasarelas que requieren POST de formulario (ej. Webpay)
  useEffect(() => {
    if (state?.formPost) postRef.current?.submit();
  }, [state?.formPost]);

  const comunas = REGIONES.find((r) => r.nombre === region)?.comunas ?? [];
  const shipping = fulfillment === "PICKUP" ? 0 : quote?.cost;
  const total = shipping == null ? null : subtotal + shipping;

  return (
    <>
      <form action={action} className="grid gap-8 lg:grid-cols-[1fr_360px]" noValidate>
        <div className="flex flex-col gap-8">
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-xl font-bold">1. Tus datos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Correo" htmlFor="email" error={err.email} className="sm:col-span-2">
                <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={customer?.email} readOnly={!!customer} />
              </Field>
              <Field label="Nombre y apellido" htmlFor="name" error={err.name}>
                <Input id="name" name="name" autoComplete="name" required defaultValue={customer?.name} />
              </Field>
              <Field label="Teléfono" htmlFor="phone" error={err.phone}>
                <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+56 9 1234 5678" required defaultValue={customer?.phone ?? ""} />
              </Field>
              <Field label="RUT (opcional)" htmlFor="rut" error={err.rut} hint="Para boleta o factura.">
                <Input id="rut" name="rut" placeholder="12.345.678-9" defaultValue={customer?.rut ?? ""} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-xl font-bold">2. Entrega</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice name="fulfillment" value="SHIPPING" checked={fulfillment === "SHIPPING"} onChange={() => setFulfillment("SHIPPING")} title="Despacho a domicilio">
                Según tu comuna
              </Choice>
              {pickup.enabled ? (
                <Choice name="fulfillment" value="PICKUP" checked={fulfillment === "PICKUP"} onChange={() => setFulfillment("PICKUP")} title="Retiro en tienda">
                  Gratis{pickup.address ? ` · ${pickup.address}` : ""}
                </Choice>
              ) : null}
            </div>

            {fulfillment === "SHIPPING" ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Región" htmlFor="region" error={err.region}>
                  <Select
                    id="region"
                    name="region"
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setComuna("");
                      setQuote(undefined);
                    }}
                  >
                    {REGIONES.map((r) => (
                      <option key={r.nombre}>{r.nombre}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Comuna" htmlFor="comuna" error={err.comuna}>
                  <Select id="comuna" name="comuna" value={comuna} onChange={(e) => setComuna(e.target.value)} required>
                    <option value="">Elige tu comuna</option>
                    {comunas.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Calle" htmlFor="street" error={err.street}>
                  <Input id="street" name="street" autoComplete="address-line1" defaultValue={def?.street} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Número" htmlFor="number" error={err.number}>
                    <Input id="number" name="number" defaultValue={def?.number} />
                  </Field>
                  <Field label="Depto. / Casa" htmlFor="apartment">
                    <Input id="apartment" name="apartment" autoComplete="address-line2" defaultValue={def?.apartment ?? ""} />
                  </Field>
                </div>
                <Field label="Indicaciones para el despacho (opcional)" htmlFor="addressNotes" className="sm:col-span-2">
                  <Input id="addressNotes" name="addressNotes" defaultValue={def?.notes ?? ""} />
                </Field>
                {customer ? (
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" name="saveAddress" value="true" defaultChecked={addresses.length === 0} /> Guardar esta dirección en mi cuenta
                  </label>
                ) : null}
                {comuna ? (
                  <p className="text-sm sm:col-span-2" role="status">
                    {quoting
                      ? "Calculando despacho…"
                      : quote
                        ? `${quote.zoneName}: ${quote.cost === 0 ? "despacho gratis" : formatCLP(quote.cost)}${quote.estimatedDays ? ` · ${quote.estimatedDays}` : ""}${quote.cost > 0 && quote.freeShippingOver ? ` · gratis sobre ${formatCLP(quote.freeShippingOver)}` : ""}`
                        : quote === null
                          ? "No despachamos a esta comuna. Puedes elegir retiro en tienda."
                          : null}
                  </p>
                ) : null}
              </div>
            ) : pickup.instructions ? (
              <p className="mt-4 text-sm text-muted">{pickup.instructions}</p>
            ) : null}
          </section>

          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-xl font-bold">3. Pago</h2>
            {paymentMethods.length ? (
              <div className="grid gap-3">
                {paymentMethods.map((m) => (
                  <Choice key={m.id} name="paymentProvider" value={m.id} checked={payment === m.id} onChange={() => setPayment(m.id)} title={m.label}>
                    {m.mode === "test" ? "Modo de pruebas · " : ""}
                    {m.instructions}
                  </Choice>
                ))}
              </div>
            ) : (
              <p className="text-sm text-danger">No hay medios de pago disponibles. Contáctanos para completar tu compra.</p>
            )}
            {err.paymentProvider ? <p className="mt-2 text-xs text-danger">{err.paymentProvider}</p> : null}
            <Field label="Comentarios del pedido (opcional)" htmlFor="customerNotes" className="mt-5">
              <Textarea id="customerNotes" name="customerNotes" rows={2} />
            </Field>
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-36">
          <h2 className="mb-4 text-xl font-bold">Resumen</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatCLP(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Despacho</dt>
              <dd>{shipping == null ? "—" : shipping === 0 ? "Gratis" : formatCLP(shipping)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-3 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-display text-2xl font-bold">{total == null ? formatCLP(subtotal) : formatCLP(total)}</dd>
            </div>
          </dl>
          {state?.error ? (
            <p role="alert" className="mt-4 rounded-md border border-danger p-3 text-sm text-danger">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending || !paymentMethods.length}>
            {pending ? "Procesando…" : "Confirmar pedido"}
          </Button>
          <p className="mt-3 text-xs text-muted">Los precios incluyen IVA.</p>
        </aside>
      </form>

      {state?.formPost ? (
        <form ref={postRef} method="POST" action={state.formPost.url} className="hidden">
          {Object.entries(state.formPost.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      ) : null}
    </>
  );
}
