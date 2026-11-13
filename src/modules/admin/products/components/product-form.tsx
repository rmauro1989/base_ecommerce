"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatCLP, formatNumber } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { kitSavings } from "@/modules/catalog/pricing";
import { ActionMessage } from "../../ui/kit";
import { Panel } from "../../ui/layout-parts";
import { saveProductAction } from "../actions";
import { isReadyToPublish, productReadiness } from "../readiness";
import type { ProductFormState } from "../form-state";
import { ImageManager } from "./image-manager";

type SaleUnit = "UNIT" | "METER" | "PACK";
type AttrField = { id: string; label: string; type: string; unit: string | null; options: string[]; required: boolean };

type Props = {
  id?: string;
  slug?: string;
  initial: ProductFormState;
  categories: { id: string; label: string }[];
  categoryFields: Record<string, AttrField[]>;
  products: { id: string; name: string }[];
  componentVariants: { id: string; label: string; saleUnit: SaleUnit; price: number }[];
};

const num = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function ProductForm({ id, slug, initial, categories, categoryFields, products, componentVariants }: Props) {
  const [f, setF] = useState<ProductFormState>(initial);
  const [state, action, pending] = useActionState(saveProductAction, null);
  const [presetInput, setPresetInput] = useState("");
  const [relatedPick, setRelatedPick] = useState("");
  const [kitPick, setKitPick] = useState("");
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof ProductFormState>(k: K, v: ProductFormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const err = state?.fieldErrors ?? {};
  const fields = useMemo(() => (f.categoryId ? (categoryFields[f.categoryId] ?? []) : []), [f.categoryId, categoryFields]);
  const isKit = f.type === "KIT";

  const readiness = productReadiness({
    name: f.name,
    price: f.price ?? 0,
    categoryId: f.categoryId || null,
    imageCount: f.images.length,
    shortDescription: f.shortDescription,
    type: f.type,
    saleUnit: f.saleUnit,
    lengthPresets: f.lengthPresets,
    allowCustomLength: f.allowCustomLength,
    totalStock: f.variants.reduce((s, v) => s + (v.active ? v.stock : 0), 0),
    kitItemCount: f.kitItems.length,
    requiredAttributes: fields.filter((a) => a.required).map((a) => ({ label: a.label, filled: !!f.attributes[a.id]?.trim() })),
  });
  const ready = isReadyToPublish(readiness);

  const kitInfo = isKit
    ? kitSavings(
        f.price ?? 0,
        f.kitItems.map((k) => {
          const v = componentVariants.find((c) => c.id === k.variantId);
          return { saleUnit: k.saleUnit, price: v?.price ?? 0, quantity: k.quantity, stock: 0 };
        }),
      )
    : null;

  const payload = JSON.stringify({
    ...f,
    categoryId: f.categoryId || null,
    price: f.price ?? 0,
    saleUnit: isKit ? "UNIT" : f.saleUnit,
    images: f.images.map((i) => ({ assetId: i.assetId, alt: i.alt })),
    variants: isKit ? [{ ...f.variants[0], name: "Por defecto", stock: 0, priceOverride: null }] : f.variants.map((v) => ({ ...v, sku: v.sku || null })),
    attributes: Object.fromEntries(Object.entries(f.attributes).filter(([k]) => fields.some((a) => a.id === k))),
    relatedIds: f.related.map((r) => r.id),
    kitItems: isKit ? f.kitItems.map((k) => ({ variantId: k.variantId, quantity: k.quantity })) : [],
    related: undefined,
  });

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <input type="hidden" name="payload" value={payload} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <div className="flex min-w-0 flex-col gap-6">
        <Panel title="Datos básicos">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="name" error={err.name} className="sm:col-span-2">
              <Input
                id="name"
                value={f.name}
                onChange={(e) => setF((p) => ({ ...p, name: e.target.value, slug: id || p.slug !== slugify(p.name) ? p.slug : slugify(e.target.value) }))}
                required
              />
            </Field>
            <Field label="URL (slug)" htmlFor="slug" error={err.slug} hint={`/producto/${f.slug || "…"}`}>
              <Input id="slug" value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} />
            </Field>
            <Field label="Marca" htmlFor="brand">
              <Input id="brand" value={f.brand} onChange={(e) => set("brand", e.target.value)} />
            </Field>
            <Field label="Categoría" htmlFor="categoryId" error={err.categoryId} className="sm:col-span-2">
              <Select id="categoryId" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Descripción corta" htmlFor="shortDescription" error={err.shortDescription} hint="Se muestra bajo el nombre y en buscadores." className="sm:col-span-2">
              <Input id="shortDescription" value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} maxLength={300} />
            </Field>
            <Field label="Descripción" htmlFor="description" error={err.description} className="sm:col-span-2">
              <Textarea id="description" value={f.description} onChange={(e) => set("description", e.target.value)} rows={5} />
            </Field>
          </div>
        </Panel>

        <Panel title="Fotos" description="La primera foto es la principal.">
          <ImageManager images={f.images} onChange={(images) => set("images", images)} onUploadingChange={setUploading} />
        </Panel>

        <Panel title={isKit ? "Precio del kit" : "Forma de venta y precio"}>
          {!isKit ? (
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["UNIT", "Por unidad", "Enchufes, interruptores…"],
                  ["METER", "Por metro", "Cables con largos y medida exacta"],
                  ["PACK", "Por rollo o caja", "Empaque cerrado"],
                ] as const
              ).map(([value, label, hint]) => (
                <label key={value} className={cn("flex cursor-pointer flex-col rounded-md border p-3", f.saleUnit === value ? "border-primary bg-primary-soft" : "border-border-strong")}>
                  <span className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="saleUnitUi" checked={f.saleUnit === value} onChange={() => set("saleUnit", value)} className="accent-primary" />
                    {label}
                  </span>
                  <span className="text-xs text-muted">{hint}</span>
                </label>
              ))}
            </div>
          ) : null}
          {err.saleUnit ? <p className="mb-3 text-xs text-danger">{err.saleUnit}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.saleUnit === "METER" && !isKit ? "Precio por metro (CLP)" : f.saleUnit === "PACK" && !isKit ? "Precio por empaque (CLP)" : "Precio (CLP)"} htmlFor="price" error={err.price} hint="IVA incluido.">
              <Input id="price" inputMode="numeric" value={f.price ?? ""} onChange={(e) => set("price", num(e.target.value.replace(/\./g, "")))} />
            </Field>
            <Field label="Precio anterior (opcional)" htmlFor="compareAtPrice" error={err.compareAtPrice} hint="Se muestra tachado como oferta.">
              <Input id="compareAtPrice" inputMode="numeric" value={f.compareAtPrice ?? ""} onChange={(e) => set("compareAtPrice", num(e.target.value.replace(/\./g, "")))} />
            </Field>
          </div>

          {f.saleUnit === "METER" && !isKit ? (
            <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5">
              <div>
                <p className="mb-2 text-sm font-medium">Largos predefinidos (metros)</p>
                <div className="flex flex-wrap items-center gap-2">
                  {f.lengthPresets.map((p) => (
                    <span key={p} className="flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 font-mono text-sm">
                      {formatNumber(p)} m
                      <button type="button" aria-label={`Quitar ${p} m`} onClick={() => set("lengthPresets", f.lengthPresets.filter((x) => x !== p))}>
                        ×
                      </button>
                    </span>
                  ))}
                  <Input
                    value={presetInput}
                    onChange={(e) => setPresetInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const n = num(presetInput);
                        if (n && n > 0 && !f.lengthPresets.includes(n)) set("lengthPresets", [...f.lengthPresets, n].sort((a, b) => a - b));
                        setPresetInput("");
                      }
                    }}
                    placeholder="Ej: 25 + Enter"
                    className="w-36"
                    aria-label="Agregar largo"
                  />
                </div>
                {err.lengthPresets ? <p className="mt-1 text-xs text-danger">{err.lengthPresets}</p> : null}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.allowCustomLength} onChange={(e) => set("allowCustomLength", e.target.checked)} /> Permitir medida exacta
              </label>
              {f.allowCustomLength ? (
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Mínimo (m)" htmlFor="minLength">
                    <Input id="minLength" inputMode="decimal" value={f.minLength ?? ""} onChange={(e) => set("minLength", num(e.target.value))} />
                  </Field>
                  <Field label="Máximo (m)" htmlFor="maxLength" error={err.maxLength}>
                    <Input id="maxLength" inputMode="decimal" value={f.maxLength ?? ""} onChange={(e) => set("maxLength", num(e.target.value))} />
                  </Field>
                  <Field label="Tramos de (m)" htmlFor="lengthStep" hint="Ej: 0,5">
                    <Input id="lengthStep" inputMode="decimal" value={f.lengthStep ?? ""} onChange={(e) => set("lengthStep", num(e.target.value))} />
                  </Field>
                </div>
              ) : null}
              <p className="text-xs text-muted">El stock de las variantes se cuenta en metros.</p>
            </div>
          ) : null}

          {f.saleUnit === "PACK" && !isKit ? (
            <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
              <Field label="Nombre del empaque" htmlFor="packLabel" error={err.packLabel} hint='Ej: "Rollo 100 m" o "Caja 10 un"'>
                <Input id="packLabel" value={f.packLabel} onChange={(e) => set("packLabel", e.target.value)} />
              </Field>
              <Field label="Contenido (metros o unidades)" htmlFor="packContent" hint="Para mostrar el precio equivalente.">
                <Input id="packContent" inputMode="decimal" value={f.packContent ?? ""} onChange={(e) => set("packContent", num(e.target.value))} />
              </Field>
            </div>
          ) : null}
        </Panel>

        {isKit ? (
          <Panel title="Componentes del kit" description="El stock del kit se calcula a partir del stock de sus componentes.">
            {f.kitItems.length ? (
              <ul className="mb-4 divide-y divide-border rounded-md border border-border">
                {f.kitItems.map((k, i) => (
                  <li key={k.variantId} className="flex items-center gap-3 p-2 text-sm">
                    <span className="flex-1">{k.label}</span>
                    <Input
                      inputMode="decimal"
                      value={k.quantity}
                      onChange={(e) => set("kitItems", f.kitItems.map((x, j) => (j === i ? { ...x, quantity: num(e.target.value) ?? 0 } : x)))}
                      className="w-20"
                      aria-label={`Cantidad de ${k.label}`}
                    />
                    <span className="w-8 text-muted">{k.saleUnit === "METER" ? "m" : "un"}</span>
                    <button type="button" className="text-xs text-danger underline" onClick={() => set("kitItems", f.kitItems.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <Select value={kitPick} onChange={(e) => setKitPick(e.target.value)} aria-label="Agregar componente">
                <option value="">Agregar componente…</option>
                {componentVariants
                  .filter((c) => !f.kitItems.some((k) => k.variantId === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  const c = componentVariants.find((x) => x.id === kitPick);
                  if (c) set("kitItems", [...f.kitItems, { variantId: c.id, quantity: c.saleUnit === "METER" ? 10 : 1, label: c.label, saleUnit: c.saleUnit }]);
                  setKitPick("");
                }}
              >
                Agregar
              </Button>
            </div>
            {err.kitItems ? <p className="mt-2 text-xs text-danger">{err.kitItems}</p> : null}
            {kitInfo && f.kitItems.length ? (
              <p className="mt-4 text-sm">
                Por separado: <strong>{formatCLP(kitInfo.componentsValue)}</strong> · Precio kit: <strong>{formatCLP(f.price ?? 0)}</strong> ·{" "}
                {kitInfo.amount > 0 ? <span className="text-success">ahorro {kitInfo.percent}%</span> : <span className="text-danger">el kit no tiene descuento</span>}
              </p>
            ) : null}
          </Panel>
        ) : null}

        <Panel title="Ficha técnica" description={f.categoryId ? "Campos sugeridos según la categoría (* obligatorio para publicar)." : "Elige una categoría para ver los campos sugeridos."}>
          {fields.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((a) => {
                const value = f.attributes[a.id] ?? "";
                const onChange = (v: string) => set("attributes", { ...f.attributes, [a.id]: v });
                const label = `${a.label}${a.unit ? ` (${a.unit})` : ""}${a.required ? " *" : ""}`;
                return (
                  <Field key={a.id} label={label} htmlFor={`attr-${a.id}`} error={err[`attributes.${a.id}`]}>
                    {a.type === "SELECT" ? (
                      <Select id={`attr-${a.id}`} value={value} onChange={(e) => onChange(e.target.value)}>
                        <option value="">—</option>
                        {a.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </Select>
                    ) : a.type === "BOOLEAN" ? (
                      <Select id={`attr-${a.id}`} value={value} onChange={(e) => onChange(e.target.value)}>
                        <option value="">—</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </Select>
                    ) : (
                      <Input id={`attr-${a.id}`} inputMode={a.type === "NUMBER" ? "decimal" : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
                    )}
                  </Field>
                );
              })}
            </div>
          ) : f.categoryId ? (
            <p className="text-sm text-muted">
              Esta categoría no tiene atributos definidos.{" "}
              <Link href="/admin/categorias" className="underline">
                Configurar
              </Link>
            </p>
          ) : null}
        </Panel>

        {!isKit ? (
          <Panel title="Variantes y stock" description="Cada variante (ej. color) tiene su propio SKU y stock.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 font-medium">Nombre</th>
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 font-medium">Precio propio</th>
                    <th className="pb-2 font-medium">Stock{f.saleUnit === "METER" ? " (m)" : ""}</th>
                    <th className="pb-2 font-medium">Activa</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {f.variants.map((v, i) => {
                    const upd = (patch: Partial<typeof v>) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <tr key={v.id ?? `new-${i}`}>
                        <td className="py-1 pr-2">
                          <Input value={v.name} onChange={(e) => upd({ name: e.target.value })} aria-label="Nombre variante" className="min-w-28" />
                        </td>
                        <td className="py-1 pr-2">
                          <Input value={v.sku} onChange={(e) => upd({ sku: e.target.value.toUpperCase() })} aria-label="SKU" className="min-w-28 font-mono" />
                        </td>
                        <td className="py-1 pr-2">
                          <Input inputMode="numeric" value={v.priceOverride ?? ""} placeholder="—" onChange={(e) => upd({ priceOverride: num(e.target.value) })} aria-label="Precio propio" className="w-28" />
                        </td>
                        <td className="py-1 pr-2">
                          <Input inputMode="decimal" value={v.stock} onChange={(e) => upd({ stock: num(e.target.value) ?? 0 })} aria-label="Stock" className="w-24" />
                        </td>
                        <td className="py-1 pr-2 text-center">
                          <input type="checkbox" checked={v.active} onChange={(e) => upd({ active: e.target.checked })} aria-label="Activa" />
                        </td>
                        <td className="py-1">
                          {f.variants.length > 1 ? (
                            <button type="button" className="text-xs text-danger underline" onClick={() => set("variants", f.variants.filter((_, j) => j !== i))}>
                              Quitar
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {err.variants || Object.keys(err).some((k) => k.startsWith("variants.")) ? (
              <p className="mt-2 text-xs text-danger">{err.variants ?? Object.entries(err).find(([k]) => k.startsWith("variants."))?.[1]}</p>
            ) : null}
            <Button variant="outline" size="sm" className="mt-3" onClick={() => set("variants", [...f.variants, { name: "", sku: "", priceOverride: null, stock: 0, active: true }])}>
              + Agregar variante
            </Button>
          </Panel>
        ) : null}

        <Panel title="Se conecta con" description="Productos relacionados que se muestran en la ficha.">
          {f.related.length ? (
            <ul className="mb-3 flex flex-wrap gap-2">
              {f.related.map((r) => (
                <li key={r.id} className="flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-sm">
                  {r.name}
                  <button type="button" aria-label={`Quitar ${r.name}`} onClick={() => set("related", f.related.filter((x) => x.id !== r.id))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <Select value={relatedPick} onChange={(e) => setRelatedPick(e.target.value)} aria-label="Agregar producto relacionado">
              <option value="">Agregar producto…</option>
              {products
                .filter((p) => p.id !== id && !f.related.some((r) => r.id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                const p = products.find((x) => x.id === relatedPick);
                if (p) set("related", [...f.related, p]);
                setRelatedPick("");
              }}
            >
              Agregar
            </Button>
          </div>
        </Panel>

        <Panel title="SEO (opcional)">
          <div className="grid gap-4">
            <Field label="Título para buscadores" htmlFor="seoTitle" hint={`${f.seoTitle.length}/70`}>
              <Input id="seoTitle" value={f.seoTitle} maxLength={70} onChange={(e) => set("seoTitle", e.target.value)} placeholder={f.name} />
            </Field>
            <Field label="Descripción para buscadores" htmlFor="seoDescription" hint={`${f.seoDescription.length}/160`}>
              <Textarea id="seoDescription" value={f.seoDescription} maxLength={160} rows={2} onChange={(e) => set("seoDescription", e.target.value)} placeholder={f.shortDescription} />
            </Field>
          </div>
        </Panel>
      </div>

      <aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-6">
        <Panel title="Estado">
          <Select value={f.status} onChange={(e) => set("status", e.target.value as ProductFormState["status"])} aria-label="Estado">
            <option value="DRAFT">Borrador</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="ARCHIVED">Archivado</option>
          </Select>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> Destacado en el inicio
          </label>
          {f.status === "PUBLISHED" && !ready ? <p className="mt-2 text-xs text-danger">Completa el checklist para publicar.</p> : null}
          <ActionMessage state={state} className="mt-3" />
          <Button type="submit" size="lg" className="mt-3 w-full" disabled={pending || uploading}>
            {uploading ? "Subiendo fotos…" : pending ? "Guardando…" : id ? "Guardar cambios" : "Crear producto"}
          </Button>
          {id && slug && initial.status === "PUBLISHED" ? (
            <Link href={`/producto/${slug}`} target="_blank" className="mt-2 block text-center text-sm text-primary underline">
              Ver en la tienda ↗
            </Link>
          ) : null}
        </Panel>

        <Panel title="Listo para publicar">
          <ul className="flex flex-col gap-1.5 text-sm">
            {readiness.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <span aria-hidden className={cn("mt-0.5 font-bold", r.ok ? "text-success" : r.blocking ? "text-danger" : "text-muted")}>
                  {r.ok ? "✓" : r.blocking ? "✗" : "•"}
                </span>
                <span className={r.ok ? "" : r.blocking ? "" : "text-muted"}>
                  {r.label}
                  {!r.blocking && !r.ok ? " (recomendado)" : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3">{ready ? <Badge tone="success">Listo para publicar</Badge> : <Badge tone="danger">Faltan datos</Badge>}</div>
        </Panel>
      </aside>
    </form>
  );
}
