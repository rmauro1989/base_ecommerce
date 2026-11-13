"use client";

import Image from "next/image";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { ThemeSample } from "@/modules/theme/components/theme-sample";
import { checkThemeContrast } from "@/modules/theme/contrast";
import { themePresets, themeToCssVars, type PresetKey } from "@/modules/theme/resolve";
import { COLOR_LABELS, COLOR_TOKENS, FONT_OPTIONS, normalizeHex, type FontKey, type ThemeTokens } from "@/modules/theme/tokens";
import { uploadImagesAction } from "../products/actions";
import { saveAppearanceAction, type AppearanceResult } from "./actions";

type Asset = { id: string; url: string } | null;

type Props = {
  storeName: string;
  contactEmail: string;
  contactPhone: string;
  seoDescription: string;
  preset: PresetKey;
  tokens: ThemeTokens;
  logo: Asset;
  favicon: Asset;
};

const FONT_KEYS = Object.keys(FONT_OPTIONS) as FontKey[];
const MONO_KEYS = FONT_KEYS.filter((k) => k.includes("mono") || k === "system");

function ImagePicker({ label, kind, value, onChange, hint }: { label: string; kind: "logo" | "favicon"; value: Asset; onChange: (a: Asset) => void; hint: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-28 items-center justify-center overflow-hidden rounded-md border border-border bg-bg">
          {value ? <Image src={value.url} alt="" width={112} height={56} unoptimized className="max-h-12 w-auto object-contain" /> : <span className="text-xs text-muted">Sin imagen</span>}
        </div>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => ref.current?.click()}>
          {pending ? "Subiendo…" : "Subir"}
        </Button>
        {value ? (
          <button type="button" className="text-xs text-danger underline" onClick={() => onChange(null)}>
            Quitar
          </button>
        ) : null}
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const fd = new FormData();
            fd.set("kind", kind);
            fd.append("files", file);
            start(async () => {
              const r = await uploadImagesAction(fd);
              if (!r.ok) return setError(r.message);
              setError(r.errors[0] ?? null);
              if (r.assets[0]) onChange(r.assets[0]);
            });
          }}
        />
      </div>
      <p className={cn("mt-1 text-xs", error ? "text-danger" : "text-muted")}>{error ?? hint}</p>
    </div>
  );
}

export function AppearanceEditor(props: Props) {
  const [preset, setPreset] = useState<PresetKey>(props.preset);
  const [tokens, setTokens] = useState<ThemeTokens>(props.tokens);
  const [storeName, setStoreName] = useState(props.storeName);
  const [contactEmail, setContactEmail] = useState(props.contactEmail);
  const [contactPhone, setContactPhone] = useState(props.contactPhone);
  const [seoDescription, setSeoDescription] = useState(props.seoDescription);
  const [logo, setLogo] = useState<Asset>(props.logo);
  const [favicon, setFavicon] = useState<Asset>(props.favicon);
  const [acceptLowContrast, setAcceptLowContrast] = useState(false);
  const [state, action, pending] = useActionState<AppearanceResult, FormData>(saveAppearanceAction, null);
  const checks = useMemo(() => checkThemeContrast(tokens), [tokens]);
  const failing = checks.filter((c) => !c.pass);
  const previewStyle = useMemo(() => themeToCssVars(tokens) as React.CSSProperties, [tokens]);
  const setToken = <K extends keyof ThemeTokens>(k: K, v: ThemeTokens[K]) => setTokens((t) => ({ ...t, [k]: v }));
  const err = state?.fieldErrors ?? {};

  const payload = JSON.stringify({ storeName, contactEmail, contactPhone, seoDescription, preset, tokens, logoAssetId: logo?.id ?? null, faviconAssetId: favicon?.id ?? null, acceptLowContrast });

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="payload" value={payload} />
      <div className="flex flex-col gap-6">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-lg font-bold">Tema base</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.entries(themePresets) as [PresetKey, (typeof themePresets)[PresetKey]][]).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setPreset(key);
                  setTokens(p.tokens);
                }}
                aria-pressed={preset === key}
                className={cn("rounded-md border p-3 text-left", preset === key ? "border-primary ring-2 ring-primary" : "border-border-strong")}
              >
                <span className="mb-2 flex gap-1">
                  {[p.tokens.colorPrimary, p.tokens.colorAccent, p.tokens.colorBg, p.tokens.colorText].map((c, i) => (
                    <span key={i} className="size-5 rounded-sm border border-border" style={{ background: c }} />
                  ))}
                </span>
                <span className="block font-semibold">{p.label}</span>
                <span className="block text-xs text-muted">{p.description}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Elegir un tema reemplaza los colores y tipografías de abajo. Luego puedes ajustarlos.</p>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-lg font-bold">Colores</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_TOKENS.map((k) => (
              <label key={k} className="flex items-center gap-3 text-sm">
                <input type="color" value={tokens[k]} onChange={(e) => setToken(k, e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-border-strong bg-surface p-1" aria-label={COLOR_LABELS[k]} />
                <span className="flex-1">
                  <span className="block font-medium">{COLOR_LABELS[k]}</span>
                  <input
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) setToken(k, normalizeHex(v));
                    }}
                    className="w-24 rounded-sm border border-border bg-bg px-1 font-mono text-xs"
                    aria-label={`${COLOR_LABELS[k]} en hexadecimal`}
                    key={tokens[k]}
                    defaultValue={tokens[k]}
                  />
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-lg font-bold">Tipografía y formas</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Títulos" htmlFor="fontDisplay">
              <Select id="fontDisplay" value={tokens.fontDisplay} onChange={(e) => setToken("fontDisplay", e.target.value as FontKey)}>
                {FONT_KEYS.filter((k) => !MONO_KEYS.includes(k) || k === "system").map((k) => (
                  <option key={k} value={k}>
                    {FONT_OPTIONS[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Texto" htmlFor="fontBody">
              <Select id="fontBody" value={tokens.fontBody} onChange={(e) => setToken("fontBody", e.target.value as FontKey)}>
                {FONT_KEYS.filter((k) => !MONO_KEYS.includes(k) || k === "system").map((k) => (
                  <option key={k} value={k}>
                    {FONT_OPTIONS[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Datos técnicos" htmlFor="fontMono">
              <Select id="fontMono" value={tokens.fontMono} onChange={(e) => setToken("fontMono", e.target.value as FontKey)}>
                {MONO_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {FONT_OPTIONS[k].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="mt-4 block text-sm">
            <span className="font-medium">Redondeo de esquinas: {tokens.radius}px</span>
            <input type="range" min={0} max={24} value={tokens.radius} onChange={(e) => setToken("radius", Number(e.target.value))} className="mt-2 w-full accent-primary" />
          </label>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-lg font-bold">Marca y datos de la tienda</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de la tienda" htmlFor="storeName" error={err.storeName} className="sm:col-span-2">
              <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </Field>
            <ImagePicker label="Logo" kind="logo" value={logo} onChange={setLogo} hint="PNG con fondo transparente. Se muestra sobre el color primario." />
            <ImagePicker label="Favicon" kind="favicon" value={favicon} onChange={setFavicon} hint="Imagen cuadrada (se ajusta a 256×256)." />
            <Field label="Correo de contacto" htmlFor="contactEmail" error={err.contactEmail}>
              <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </Field>
            <Field label="Teléfono de contacto" htmlFor="contactPhone">
              <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </Field>
            <Field label="Descripción para buscadores" htmlFor="seoDescription" hint={`${seoDescription.length}/160`} className="sm:col-span-2">
              <Textarea id="seoDescription" value={seoDescription} maxLength={160} rows={2} onChange={(e) => setSeoDescription(e.target.value)} />
            </Field>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:h-fit">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Vista previa</h2>
            {failing.length ? <Badge tone="danger">No cumple AA ({failing.length})</Badge> : <Badge tone="success">Contraste AA ✓</Badge>}
          </div>
          <div data-theme-scope style={previewStyle} className="rounded-lg p-4" aria-label="Vista previa del tema">
            <ThemeSample storeName={storeName || "Mi tienda"} />
          </div>
          <details className="mt-3 text-sm" open={failing.length > 0}>
            <summary className="cursor-pointer font-medium">Detalle de contraste</summary>
            <table className="mt-2 w-full font-mono text-xs">
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-1">{c.label}</td>
                    <td className={cn("py-1 text-right", !c.pass && "font-bold text-danger")}>
                      {c.ratio.toFixed(2)}:1 {c.pass ? "✓" : `✗ (mín. ${c.required})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          {state?.contrastWarning ? (
            <div role="alert" className="mb-3 rounded-md border border-danger p-3 text-sm">
              <p className="font-semibold text-danger">{state.message}</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {state.contrastWarning.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : state?.message ? (
            <p role="status" className={cn("mb-3 rounded-md border p-3 text-sm", state.ok ? "border-success text-success" : "border-danger text-danger")}>
              {state.message}
            </p>
          ) : null}
          {failing.length ? (
            <label className="mb-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={acceptLowContrast} onChange={(e) => setAcceptLowContrast(e.target.checked)} className="mt-1" />
              Entiendo que algunos textos pueden ser difíciles de leer y quiero guardar igual.
            </label>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Guardando…" : "Guardar apariencia"}
          </Button>
          <p className="mt-2 text-xs text-muted">Los valores por defecto viven en theme.config.ts; lo que guardas aquí los sobrescribe.</p>
        </section>
      </div>
    </form>
  );
}
