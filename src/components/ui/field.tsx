import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "rounded-md border border-border-strong bg-surface px-3 text-sm text-text placeholder:text-muted " +
  "focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60";

/** Ancho completo salvo que se indique otro ancho (w-…) en className. */
const width = (className?: string) => (className && /(^|\s)(\w+:)?w-/.test(className) ? "" : "w-full");

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, width(className), "h-10", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, width(className), "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, width(className), "min-h-24 py-2", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
