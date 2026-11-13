"use client";

import { createContext, useActionState, useContext, type ReactNode } from "react";
import { Field } from "@/components/ui/field";
import type { ActionResult } from "../guard";
import { ActionMessage } from "./kit";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const ErrorsContext = createContext<Record<string, string>>({});

/**
 * Formulario para server actions del admin. Se puede usar desde Server
 * Components: los errores por campo llegan a <FormField name="…"> vía contexto.
 */
export function ActionForm({ action, children, className, confirm }: { action: Action; children: ReactNode; className?: string; confirm?: string }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <ErrorsContext.Provider value={state?.fieldErrors ?? {}}>
      <form
        action={formAction}
        className={className}
        onSubmit={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        {children}
        <ActionMessage state={state} className="mt-3" />
      </form>
    </ErrorsContext.Provider>
  );
}

export function FormField({ name, label, hint, htmlFor, children, className }: { name: string; label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  const errors = useContext(ErrorsContext);
  return (
    <Field label={label} hint={hint} error={errors[name]} htmlFor={htmlFor ?? name} className={className}>
      {children}
    </Field>
  );
}
