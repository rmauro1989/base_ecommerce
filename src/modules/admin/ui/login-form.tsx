"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginAdmin } from "@/modules/auth/admin-actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Correo" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar al panel"}
      </Button>
    </form>
  );
}
