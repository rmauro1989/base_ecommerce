"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { ProductImage } from "@/components/store/product-image";
import { formatCLP, formatNumber } from "@/lib/money";
import { ActionMessage, SubmitButton } from "../../ui/kit";
import { tableClasses as t } from "../../ui/layout-parts";
import { bulkProductsAction } from "../actions";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  category: string | null;
  type: "SIMPLE" | "KIT";
  saleUnit: "UNIT" | "METER" | "PACK";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  price: number;
  stock: number;
};

const STATUS = { DRAFT: ["Borrador", "neutral"], PUBLISHED: ["Publicado", "success"], ARCHIVED: ["Archivado", "danger"] } as const;

export function ProductTable({ rows, categories }: { rows: ProductRow[]; categories: { id: string; label: string }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState("price");
  const [state, formAction] = useActionState(bulkProductsAction, null);
  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3" onSubmit={() => setTimeout(() => setSelected(new Set()), 0)}>
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
        <span className="mr-2 self-center text-sm font-semibold">{selected.size} seleccionado(s)</span>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Acción
          <Select name="action" value={action} onChange={(e) => setAction(e.target.value)} className="w-48">
            <option value="price">Cambiar precio (%)</option>
            <option value="publish">Publicar</option>
            <option value="hide">Ocultar (borrador)</option>
            <option value="category">Mover a categoría</option>
          </Select>
        </label>
        {action === "price" ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Porcentaje
              <Input name="percent" type="number" step="any" placeholder="Ej: 5 o -10" className="w-32" required />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Redondear a
              <Select name="roundTo" defaultValue="10" className="w-28">
                <option value="1">$1</option>
                <option value="10">$10</option>
                <option value="100">$100</option>
              </Select>
            </label>
          </>
        ) : null}
        {action === "category" ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Categoría
            <Select name="categoryId" className="w-56" required>
              <option value="">Elegir…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <SubmitButton pendingLabel="Aplicando…" className={selected.size ? "" : "pointer-events-none opacity-50"}>
          Aplicar
        </SubmitButton>
        <ActionMessage state={state} className="w-full" />
      </form>

      <div className={t.wrap}>
        <table className={t.table}>
          <thead>
            <tr>
              <th className={`${t.th} w-8`}>
                <input type="checkbox" aria-label="Seleccionar todos" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} />
              </th>
              <th className={t.th}>Producto</th>
              <th className={t.th}>Categoría</th>
              <th className={t.th}>Estado</th>
              <th className={`${t.th} text-right`}>Precio</th>
              <th className={`${t.th} text-right`}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-primary-soft" : ""}>
                <td className={t.td}>
                  <input type="checkbox" aria-label={`Seleccionar ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td className={t.td}>
                  <div className="flex items-center gap-3">
                    <ProductImage src={r.imageUrl} alt="" className="w-10 shrink-0 rounded-sm" sizes="40px" />
                    <div>
                      <Link href={`/admin/productos/${r.id}`} className="font-semibold hover:underline">
                        {r.name}
                      </Link>
                      <p className="font-mono text-xs text-muted">
                        {r.type === "KIT" ? "KIT · " : ""}
                        {r.sku ?? "sin SKU"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={t.td}>{r.category ?? <span className="text-muted">—</span>}</td>
                <td className={t.td}>
                  <Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
                </td>
                <td className={`${t.td} text-right whitespace-nowrap`}>
                  {formatCLP(r.price)}
                  {r.saleUnit === "METER" ? <span className="text-xs text-muted">/m</span> : null}
                </td>
                <td className={`${t.td} text-right font-mono`}>
                  {r.type === "KIT" ? <span className="text-muted">—</span> : `${formatNumber(r.stock)}${r.saleUnit === "METER" ? " m" : ""}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
