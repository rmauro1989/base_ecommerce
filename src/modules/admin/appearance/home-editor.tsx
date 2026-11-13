"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { ActionMessage } from "../ui/kit";
import { saveHomeSectionsAction } from "./actions";

type SectionType = "HERO" | "CATEGORIES" | "KITS" | "BESTSELLERS" | "FEATURED" | "BANNER";
export type HomeSectionInput = { id?: string; type: SectionType; enabled: boolean; title: string | null; subtitle: string | null; limit?: number | null; href?: string | null; cta?: string | null };

const LABELS: Record<SectionType, string> = {
  HERO: "Portada con buscador",
  CATEGORIES: "Categorías",
  KITS: "Kits por proyecto",
  BESTSELLERS: "Más vendidos",
  FEATURED: "Productos destacados",
  BANNER: "Banner promocional",
};

export function HomeEditor({ initial }: { initial: HomeSectionInput[] }) {
  const [sections, setSections] = useState(initial);
  const [newType, setNewType] = useState<SectionType>("BANNER");
  const [state, action, pending] = useActionState(saveHomeSectionsAction, null);
  const update = (i: number, patch: Partial<HomeSectionInput>) => setSections((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setSections((s) => {
      const next = [...s];
      const j = i + d;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={JSON.stringify(sections)} />
      {sections.map((s, i) => (
        <section key={s.id ?? `new-${i}`} className={cn("rounded-lg border bg-surface p-4", s.enabled ? "border-border" : "border-dashed border-border-strong opacity-75")}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft font-mono text-xs">{i + 1}</span>
            <span className="font-semibold">{LABELS[s.type]}</span>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} /> Visible
            </label>
            <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
              ↑
            </Button>
            <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Bajar">
              ↓
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSections((x) => x.filter((_, j) => j !== i))}>
              Quitar
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título" htmlFor={`t-${i}`}>
              <Input id={`t-${i}`} value={s.title ?? ""} onChange={(e) => update(i, { title: e.target.value })} />
            </Field>
            <Field label="Subtítulo" htmlFor={`s-${i}`}>
              <Input id={`s-${i}`} value={s.subtitle ?? ""} onChange={(e) => update(i, { subtitle: e.target.value })} />
            </Field>
            {["KITS", "BESTSELLERS", "FEATURED"].includes(s.type) ? (
              <Field label="Cantidad de productos" htmlFor={`l-${i}`}>
                <Input id={`l-${i}`} type="number" min={1} max={24} value={s.limit ?? ""} onChange={(e) => update(i, { limit: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            ) : null}
            {s.type === "BANNER" ? (
              <>
                <Field label="Enlace (ej. /kits)" htmlFor={`h-${i}`} error={state?.fieldErrors?.[`${i}.href`]}>
                  <Input id={`h-${i}`} value={s.href ?? ""} onChange={(e) => update(i, { href: e.target.value })} />
                </Field>
                <Field label="Texto del botón" htmlFor={`c-${i}`}>
                  <Input id={`c-${i}`} value={s.cta ?? ""} onChange={(e) => update(i, { cta: e.target.value })} />
                </Field>
              </>
            ) : null}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border-strong p-4">
        <Field label="Agregar sección" htmlFor="newType">
          <Select id="newType" value={newType} onChange={(e) => setNewType(e.target.value as SectionType)}>
            {Object.entries(LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="outline" onClick={() => setSections((s) => [...s, { type: newType, enabled: true, title: LABELS[newType], subtitle: null, limit: null, href: null, cta: null }])}>
          Agregar
        </Button>
      </div>
      <ActionMessage state={state} />
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : "Guardar inicio"}
        </Button>
      </div>
    </form>
  );
}
