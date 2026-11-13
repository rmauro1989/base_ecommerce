import { connection } from "next/server";
import { requireAdmin } from "@/modules/auth/admin";
import { PageHeader, Panel } from "@/modules/admin/ui/layout-parts";

// Se implementa en la etapa (e)
export default async function ImportPage() {
  await connection();
  await requireAdmin();
  return (
    <>
      <PageHeader title="Carga masiva" />
      <Panel>
        <p className="text-sm text-muted">Disponible próximamente.</p>
      </Panel>
    </>
  );
}
