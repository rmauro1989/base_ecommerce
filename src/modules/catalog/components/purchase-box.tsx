"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatCLP, formatNumber } from "@/lib/money";
import { addToCart, type CartActionState } from "@/modules/cart/actions";
import { MAX_QUANTITY, piecePrice, pricePerContentUnit, validateLength, type LengthRules } from "../pricing";

type Variant = { id: string; name: string; sku: string | null; price: number; stock: number; isDefault: boolean };

type Props = LengthRules & {
  type: "SIMPLE" | "KIT";
  price: number;
  compareAtPrice: number | null;
  packLabel: string | null;
  packContent: number | null;
  variants: Variant[];
};

export function PurchaseBox(props: Props) {
  const initial = props.variants.find((v) => v.isDefault && v.stock > 0) ?? props.variants.find((v) => v.stock > 0) ?? props.variants[0];
  const [variantId, setVariantId] = useState(initial?.id);
  const variant = props.variants.find((v) => v.id === variantId) ?? initial;
  const isMeter = props.saleUnit === "METER";
  const [preset, setPreset] = useState<number | "custom">(isMeter ? (props.lengthPresets[0] ?? "custom") : "custom");
  const [custom, setCustom] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [state, action, pending] = useActionState<CartActionState, FormData>(addToCart, null);

  const length = isMeter ? (preset === "custom" ? Number(custom.replace(",", ".")) || null : preset) : null;
  const lengthCheck = useMemo(() => validateLength(props, length), [props, length]);
  const unit = variant?.price ?? props.price;
  const piece = isMeter ? (lengthCheck.ok && length ? piecePrice("METER", unit, length) : null) : unit;
  const total = piece != null ? piece * quantity : null;
  const stock = variant?.stock ?? 0;
  const outOfStock = stock <= 0;
  const showVariants = props.variants.length > 1 || (props.variants[0] && props.variants[0].name !== "Por defecto");

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="variantId" value={variant?.id ?? ""} />
      <input type="hidden" name="length" value={isMeter && length ? String(length) : ""} />
      <input type="hidden" name="quantity" value={quantity} />

      <div>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-display text-3xl font-bold">{formatCLP(unit)}</span>
          {props.compareAtPrice && props.compareAtPrice > unit ? <s className="text-muted">{formatCLP(props.compareAtPrice)}</s> : null}
          <span className="text-sm text-muted">
            {isMeter ? "por metro" : props.saleUnit === "PACK" ? `por ${props.packLabel?.toLowerCase() ?? "empaque"}` : props.type === "KIT" ? "precio del kit" : "por unidad"}
          </span>
        </div>
        {props.saleUnit === "PACK" && props.packContent ? (
          <p className="mt-1 text-sm text-muted">
            Equivale a {formatCLP(pricePerContentUnit(unit, props.packContent)!)} por unidad de contenido ({formatNumber(props.packContent)} por empaque).
          </p>
        ) : null}
      </div>

      {showVariants ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Color / variante: <span className="font-normal">{variant?.name}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {props.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                aria-pressed={v.id === variant?.id}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm",
                  v.id === variant?.id ? "border-primary bg-primary-soft font-semibold" : "border-border-strong bg-surface hover:border-primary",
                  v.stock <= 0 && "line-through opacity-60",
                )}
              >
                {v.name}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {isMeter ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Largo</legend>
          <div className="flex flex-wrap gap-2">
            {props.lengthPresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                aria-pressed={preset === p}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-mono text-sm",
                  preset === p ? "border-primary bg-primary-soft font-semibold" : "border-border-strong bg-surface hover:border-primary",
                )}
              >
                {formatNumber(p)} m
              </button>
            ))}
            {props.allowCustomLength ? (
              <button
                type="button"
                onClick={() => setPreset("custom")}
                aria-pressed={preset === "custom"}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm",
                  preset === "custom" ? "border-primary bg-primary-soft font-semibold" : "border-border-strong bg-surface hover:border-primary",
                )}
              >
                Medida exacta
              </button>
            ) : null}
          </div>
          {preset === "custom" ? (
            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  inputMode="decimal"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder={props.minLength ? `Mín. ${formatNumber(props.minLength)}` : "Metros"}
                  className="h-10 w-32 rounded-md border border-border-strong bg-surface px-3 font-mono"
                  aria-label="Largo exacto en metros"
                />
                <span>metros</span>
              </label>
              <p className={cn("mt-1 text-xs", custom && !lengthCheck.ok ? "text-danger" : "text-muted")}>
                {custom && !lengthCheck.ok
                  ? lengthCheck.error
                  : [
                      props.minLength ? `mínimo ${formatNumber(props.minLength)} m` : null,
                      props.maxLength ? `máximo ${formatNumber(props.maxLength)} m` : null,
                      props.lengthStep ? `en tramos de ${formatNumber(props.lengthStep)} m` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
            </div>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="mb-2 block text-sm font-semibold">{isMeter ? "Piezas" : "Cantidad"}</span>
          <div className="flex h-11 items-center rounded-md border border-border-strong bg-surface">
            <button type="button" className="h-full px-3 text-lg" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Restar">
              −
            </button>
            <input
              value={quantity}
              onChange={(e) => setQuantity(Math.min(MAX_QUANTITY, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
              inputMode="numeric"
              className="h-full w-12 bg-transparent text-center font-mono"
              aria-label="Cantidad"
            />
            <button type="button" className="h-full px-3 text-lg" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} aria-label="Sumar">
              +
            </button>
          </div>
        </div>
        <div className="ml-auto text-right">
          <span className="block text-xs text-muted">Total</span>
          <span className="font-display text-2xl font-bold">{total != null ? formatCLP(total) : "—"}</span>
          {isMeter && length && lengthCheck.ok ? (
            <span className="block text-xs text-muted">
              {quantity} × {formatNumber(length)} m
            </span>
          ) : null}
        </div>
      </div>

      <p className={cn("text-sm", outOfStock ? "text-danger" : "text-success")}>
        {outOfStock
          ? "Sin stock por ahora"
          : props.type === "KIT"
            ? `Disponible (${stock} kit${stock === 1 ? "" : "s"})`
            : isMeter
              ? `Disponible: ${formatNumber(stock)} m`
              : `Disponible: ${formatNumber(stock)}`}
      </p>

      <Button type="submit" size="lg" disabled={pending || outOfStock || (isMeter && !lengthCheck.ok)} className="w-full">
        {pending ? "Agregando…" : "Agregar al carro"}
      </Button>

      {state ? (
        <p role="status" className={cn("text-sm", state.ok ? "text-success" : "text-danger")}>
          {state.message}{" "}
          {state.ok ? (
            <Link href="/carrito" className="font-semibold underline">
              Ver carro
            </Link>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
