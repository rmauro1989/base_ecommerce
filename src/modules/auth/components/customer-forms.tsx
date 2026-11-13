"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginCustomer, registerCustomer, updateProfile, type FormState } from "../customer-actions";

function FormError({ state }: { state: FormState }) {
  return state?.error ? (
    <p role="alert" className="rounded-md border border-danger p-3 text-sm text-danger">
      {state.error}
    </p>
  ) : null;
}

export function LoginForm({ volver }: { volver?: string }) {
  const [state, action, pending] = useActionState(loginCustomer, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="volver" value={volver ?? ""} />
      <Field label="Correo" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormError state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
      <p className="text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href={`/cuenta/registro${volver ? `?volver=${encodeURIComponent(volver)}` : ""}`} className="font-semibold text-primary underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ volver }: { volver?: string }) {
  const [state, action, pending] = useActionState(registerCustomer, null);
  const e = state?.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="volver" value={volver ?? ""} />
      <Field label="Nombre y apellido" htmlFor="name" error={e.name}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Correo" htmlFor="email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Teléfono (opcional)" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={e.password} hint="Mínimo 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirm" error={e.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FormError state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/cuenta/ingresar" className="font-semibold text-primary underline">
          Ingresar
        </Link>
      </p>
    </form>
  );
}

export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Nombre" htmlFor="p-name" error={state?.fieldErrors?.name}>
        <Input id="p-name" name="name" defaultValue={name} />
      </Field>
      <Field label="Teléfono" htmlFor="p-phone">
        <Input id="p-phone" name="phone" defaultValue={phone ?? ""} />
      </Field>
      <FormError state={state} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Guardando…" : "Guardar datos"}
      </Button>
    </form>
  );
}
