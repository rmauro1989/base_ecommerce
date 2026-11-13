"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ActionResult } from "../guard";

/** Botón de envío que se deshabilita mientras la acción corre. */
export function SubmitButton({ children, pendingLabel, variant, className, name, value }: { children: ReactNode; pendingLabel?: string; variant?: ButtonVariant; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className} name={name} value={value}>
      {pending ? (pendingLabel ?? "Guardando…") : children}
    </Button>
  );
}

export function ActionMessage({ state, className }: { state: ActionResult; className?: string }) {
  if (!state?.message) return null;
  return (
    <p role="status" className={cn("rounded-md border p-3 text-sm", state.ok ? "border-success text-success" : "border-danger text-danger", className)}>
      {state.message}
    </p>
  );
}
