import type { Metadata } from "next";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/field";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { getProvider } from "@/modules/payments/registry";
import { saveBankInfoAction, savePaymentMethodAction } from "@/modules/admin/settings/actions";
import { ActionForm, FormField } from "@/modules/admin/ui/action-form";
import { SubmitButton } from "@/modules/admin/ui/kit";
import { PageHeader, Panel } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Medios de pago" };

const ENV_HELP = {
  WEBPAY: "Variables: TRANSBANK_ENVIRONMENT, TRANSBANK_COMMERCE_CODE, TRANSBANK_API_KEY. Sin ellas usa el ambiente de integración (pruebas).",
  MERCADOPAGO: "Variables: MERCADOPAGO_ACCESS_TOKEN (y opcionalmente MERCADOPAGO_WEBHOOK_SECRET). Usa un token de prueba (TEST-…) para el modo de pruebas.",
  MANUAL_TRANSFER: "No requiere variables. El pedido queda pendiente hasta que lo marques como pagado.",
} as const;

export default async function PaymentsPage() {
  await connection();
  await requireAdmin("OWNER");
  const [methods, settings] = await Promise.all([db.paymentMethodSetting.findMany({ orderBy: { position: "asc" } }), db.storeSettings.findUnique({ where: { id: 1 } })]);
  const bank = (settings?.bankTransferInfo ?? {}) as Record<string, string>;
  return (
    <>
      <PageHeader title="Medios de pago" description="Las credenciales viven solo en variables de entorno (nunca en la base). Aquí activas cada medio y editas sus textos." />
      <div className="flex flex-col gap-6">
        {methods.map((m) => {
          const provider = getProvider(m.provider);
          const configured = provider?.isConfigured() ?? false;
          return (
            <Panel
              key={m.provider}
              title={m.displayName}
              description={ENV_HELP[m.provider]}
              actions={
                <div className="flex flex-col items-end gap-1">
                  {configured ? (
                    <Badge tone={provider!.mode() === "test" ? "accent" : "success"}>{provider!.mode() === "test" ? "Modo pruebas" : "Producción"}</Badge>
                  ) : (
                    <Badge tone="danger">Sin configurar</Badge>
                  )}
                </div>
              }
            >
              <ActionForm action={savePaymentMethodAction} className="flex flex-col gap-3">
                <input type="hidden" name="provider" value={m.provider} />
                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <FormField name="displayName" label="Nombre visible" htmlFor={`dn-${m.provider}`}>
                    <Input id={`dn-${m.provider}`} name="displayName" defaultValue={m.displayName} />
                  </FormField>
                  <FormField name="position" label="Orden" htmlFor={`pos-${m.provider}`}>
                    <Input id={`pos-${m.provider}`} name="position" type="number" min={0} defaultValue={m.position} />
                  </FormField>
                </div>
                <FormField name="instructions" label="Texto para el cliente (opcional)" htmlFor={`in-${m.provider}`}>
                  <Textarea id={`in-${m.provider}`} name="instructions" rows={2} defaultValue={m.instructions ?? ""} />
                </FormField>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="enabled" defaultChecked={m.enabled} /> Activo en el checkout
                  </label>
                  <SubmitButton>Guardar</SubmitButton>
                </div>
                {m.enabled && !configured ? <p className="text-xs text-danger">Está activo pero no aparecerá en el checkout hasta configurar sus variables de entorno.</p> : null}
              </ActionForm>
            </Panel>
          );
        })}
        <Panel title="Datos para transferencia" description="Se muestran al cliente en la confirmación del pedido y en el correo.">
          <ActionForm action={saveBankInfoAction} className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["banco", "Banco"],
                ["tipoCuenta", "Tipo de cuenta"],
                ["numeroCuenta", "N° de cuenta"],
                ["titular", "Titular"],
                ["rut", "RUT"],
                ["email", "Correo para comprobantes"],
              ] as const
            ).map(([k, label]) => (
              <FormField key={k} name={k} label={label}>
                <Input id={k} name={k} defaultValue={bank[k] ?? ""} />
              </FormField>
            ))}
            <div className="sm:col-span-2">
              <SubmitButton>Guardar datos bancarios</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
