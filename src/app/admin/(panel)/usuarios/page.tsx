import type { Metadata } from "next";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { saveAdminUserAction } from "@/modules/admin/settings/actions";
import { ActionForm, FormField } from "@/modules/admin/ui/action-form";
import { SubmitButton } from "@/modules/admin/ui/kit";
import { PageHeader, Panel } from "@/modules/admin/ui/layout-parts";

export const metadata: Metadata = { title: "Usuarios" };

type User = { id: string; name: string; email: string; role: "OWNER" | "EDITOR"; active: boolean };

function UserForm({ user }: { user?: User }) {
  const k = user?.id ?? "new";
  return (
    <ActionForm action={saveAdminUserAction} className="grid gap-3 sm:grid-cols-2">
      {user ? <input type="hidden" name="id" value={user.id} /> : null}
      <FormField name="name" label="Nombre" htmlFor={`n-${k}`}>
        <Input id={`n-${k}`} name="name" defaultValue={user?.name} required />
      </FormField>
      <FormField name="email" label="Correo" htmlFor={`e-${k}`}>
        <Input id={`e-${k}`} name="email" type="email" defaultValue={user?.email} required />
      </FormField>
      <FormField name="role" label="Rol" htmlFor={`r-${k}`} hint="Editor: catálogo, pedidos y clientes. Dueño: además apariencia, despacho, pagos y usuarios.">
        <Select id={`r-${k}`} name="role" defaultValue={user?.role ?? "EDITOR"}>
          <option value="EDITOR">Editor</option>
          <option value="OWNER">Dueño</option>
        </Select>
      </FormField>
      <FormField name="password" label={user ? "Nueva contraseña (opcional)" : "Contraseña inicial"} htmlFor={`p-${k}`} hint="Mínimo 8 caracteres.">
        <Input id={`p-${k}`} name="password" type="password" autoComplete="new-password" />
      </FormField>
      <div className="flex items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={user?.active ?? true} /> Activo
        </label>
        <SubmitButton>{user ? "Guardar" : "Crear usuario"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function UsersPage() {
  await connection();
  const me = await requireAdmin("OWNER");
  const users = await db.adminUser.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHeader title="Usuarios del panel" />
      <div className="flex flex-col gap-6">
        {users.map((u) => (
          <Panel
            key={u.id}
            title={`${u.name}${u.id === me.id ? " (tú)" : ""}`}
            description={u.email}
            actions={
              <div className="flex gap-1">
                <Badge tone={u.role === "OWNER" ? "primary" : "soft"}>{u.role === "OWNER" ? "Dueño" : "Editor"}</Badge>
                {!u.active ? <Badge tone="danger">Inactivo</Badge> : null}
              </div>
            }
          >
            <UserForm user={u} />
          </Panel>
        ))}
        <Panel title="Nuevo usuario">
          <UserForm />
        </Panel>
      </div>
    </>
  );
}
