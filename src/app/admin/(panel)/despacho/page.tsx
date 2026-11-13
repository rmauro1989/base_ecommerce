import type { Metadata } from "next";
import { connection } from "next/server";
import { Input, Textarea } from "@/components/ui/field";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { requireAdmin } from "@/modules/auth/admin";
import { deleteZoneAction, savePickupAction, saveZoneAction } from "@/modules/admin/settings/actions";
import { ActionForm, FormField } from "@/modules/admin/ui/action-form";
import { SubmitButton } from "@/modules/admin/ui/kit";
import { PageHeader, Panel } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Despacho y retiro" };

type Zone = Awaited<ReturnType<typeof db.shippingZone.findMany>>[number];

function ZoneForm({ zone, position }: { zone?: Zone; position: number }) {
  return (
    <ActionForm action={saveZoneAction} className="flex flex-col gap-3">
      {zone ? <input type="hidden" name="id" value={zone.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField name="name" label="Nombre de la zona" htmlFor={`name-${zone?.id ?? "new"}`}>
          <Input id={`name-${zone?.id ?? "new"}`} name="name" defaultValue={zone?.name} required />
        </FormField>
        <FormField name="estimatedDays" label="Plazo estimado" htmlFor={`days-${zone?.id ?? "new"}`}>
          <Input id={`days-${zone?.id ?? "new"}`} name="estimatedDays" defaultValue={zone?.estimatedDays ?? ""} placeholder="Ej: 1 a 2 días hábiles" />
        </FormField>
        <FormField name="price" label="Tarifa (CLP)" htmlFor={`price-${zone?.id ?? "new"}`}>
          <Input id={`price-${zone?.id ?? "new"}`} name="price" inputMode="numeric" defaultValue={zone?.price ?? ""} required />
        </FormField>
        <FormField name="freeShippingOver" label="Gratis sobre (CLP, opcional)" htmlFor={`free-${zone?.id ?? "new"}`}>
          <Input id={`free-${zone?.id ?? "new"}`} name="freeShippingOver" inputMode="numeric" defaultValue={zone?.freeShippingOver ?? ""} />
        </FormField>
        <FormField name="comunas" label="Comunas" hint="Separadas por coma o una por línea. Se validan contra el listado oficial." htmlFor={`comunas-${zone?.id ?? "new"}`} className="sm:col-span-2">
          <Textarea id={`comunas-${zone?.id ?? "new"}`} name="comunas" rows={3} defaultValue={zone?.comunas.join(", ")} />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={zone?.active ?? true} /> Activa
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isFallback" defaultChecked={zone?.isFallback ?? false} /> Resto del país (comunas no listadas)
        </label>
        <input type="hidden" name="position" value={zone?.position ?? position} />
        <SubmitButton>{zone ? "Guardar zona" : "Crear zona"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function ShippingPage() {
  await connection();
  await requireAdmin("OWNER");
  const [zones, settings] = await Promise.all([db.shippingZone.findMany({ orderBy: { position: "asc" } }), db.storeSettings.findUnique({ where: { id: 1 } })]);
  return (
    <>
      <PageHeader title="Despacho y retiro" description="La tarifa se calcula según la comuna de despacho. La zona “resto del país” aplica a todas las comunas no listadas." />
      <div className="flex flex-col gap-6">
        {zones.map((z) => (
          <Panel
            key={z.id}
            title={`${z.name}${z.active ? "" : " (inactiva)"}`}
            description={`${formatCLP(z.price)}${z.freeShippingOver ? ` · gratis sobre ${formatCLP(z.freeShippingOver)}` : ""} · ${z.isFallback ? "Resto del país" : `${z.comunas.length} comuna(s)`}`}
            actions={
              <ActionForm action={deleteZoneAction} confirm={`¿Eliminar la zona "${z.name}"?`}>
                <input type="hidden" name="id" value={z.id} />
                <SubmitButton variant="ghost" pendingLabel="…">
                  Eliminar
                </SubmitButton>
              </ActionForm>
            }
          >
            <ZoneForm zone={z} position={z.position} />
          </Panel>
        ))}
        <Panel title="Nueva zona">
          <ZoneForm position={zones.length} />
        </Panel>
        <Panel title="Retiro en tienda">
          <ActionForm action={savePickupAction} className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pickupEnabled" defaultChecked={settings?.pickupEnabled} /> Ofrecer retiro en tienda (gratis)
            </label>
            <FormField name="pickupAddress" label="Dirección de retiro">
              <Input id="pickupAddress" name="pickupAddress" defaultValue={settings?.pickupAddress ?? ""} />
            </FormField>
            <FormField name="pickupInstructions" label="Horario e instrucciones">
              <Textarea id="pickupInstructions" name="pickupInstructions" rows={2} defaultValue={settings?.pickupInstructions ?? ""} />
            </FormField>
            <div>
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
