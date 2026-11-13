import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, description, children, className, actions }: { title?: string; description?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface p-5", className)}>
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {description ? <p className="text-sm text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export const tableClasses = {
  wrap: "overflow-x-auto rounded-lg border border-border bg-surface",
  table: "w-full text-sm",
  th: "border-b border-border bg-bg px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase",
  td: "border-b border-border px-3 py-2 align-middle",
};

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border-strong p-10 text-center text-muted">{children}</div>;
}
