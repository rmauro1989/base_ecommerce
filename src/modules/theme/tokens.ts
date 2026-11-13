/**
 * Definición de los tokens del tema (sin dependencias de Next: se usa en
 * servidor, cliente y tests).
 */
import { z } from "zod";

/** Tipografías disponibles (cargadas con next/font en fonts.ts). */
export const FONT_OPTIONS = {
  inter: { label: "Inter", cssVar: "--ff-inter", fallback: "ui-sans-serif, system-ui, sans-serif" },
  "space-grotesk": { label: "Space Grotesk", cssVar: "--ff-space-grotesk", fallback: "ui-sans-serif, system-ui, sans-serif" },
  "plus-jakarta": { label: "Plus Jakarta Sans", cssVar: "--ff-plus-jakarta", fallback: "ui-sans-serif, system-ui, sans-serif" },
  manrope: { label: "Manrope", cssVar: "--ff-manrope", fallback: "ui-sans-serif, system-ui, sans-serif" },
  "dm-sans": { label: "DM Sans", cssVar: "--ff-dm-sans", fallback: "ui-sans-serif, system-ui, sans-serif" },
  archivo: { label: "Archivo", cssVar: "--ff-archivo", fallback: "ui-sans-serif, system-ui, sans-serif" },
  barlow: { label: "Barlow", cssVar: "--ff-barlow", fallback: "ui-sans-serif, system-ui, sans-serif" },
  "barlow-condensed": { label: "Barlow Condensed", cssVar: "--ff-barlow-condensed", fallback: "ui-sans-serif, system-ui, sans-serif" },
  "jetbrains-mono": { label: "JetBrains Mono", cssVar: "--ff-jetbrains-mono", fallback: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  "ibm-plex-mono": { label: "IBM Plex Mono", cssVar: "--ff-ibm-plex-mono", fallback: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  system: { label: "Sistema", cssVar: null, fallback: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
} as const;

export type FontKey = keyof typeof FONT_OPTIONS;
export const FONT_KEYS = Object.keys(FONT_OPTIONS) as [FontKey, ...FontKey[]];

const hex = z
  .string()
  .trim()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, "Color inválido (usa formato #RRGGBB)")
  .transform((v) => normalizeHex(v));

export const themeTokensSchema = z.object({
  colorPrimary: hex,
  colorAccent: hex,
  colorBg: hex,
  colorSurface: hex,
  colorText: hex,
  colorMuted: hex,
  /** Radio base en px */
  radius: z.coerce.number().min(0).max(32),
  fontDisplay: z.enum(FONT_KEYS),
  fontBody: z.enum(FONT_KEYS),
  fontMono: z.enum(FONT_KEYS),
});

export type ThemeTokens = z.output<typeof themeTokensSchema>;

/** Overrides parciales guardados en la base (StoreSettings.themeOverrides). */
export const themeOverridesSchema = themeTokensSchema.partial();
export type ThemeOverrides = z.output<typeof themeOverridesSchema>;

export type ThemePreset = { label: string; description: string; tokens: ThemeTokens };

export const COLOR_TOKENS = ["colorPrimary", "colorAccent", "colorBg", "colorSurface", "colorText", "colorMuted"] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export const COLOR_LABELS: Record<ColorToken, string> = {
  colorPrimary: "Primario",
  colorAccent: "Acento",
  colorBg: "Fondo",
  colorSurface: "Superficie",
  colorText: "Texto",
  colorMuted: "Texto secundario",
};

export function normalizeHex(value: string): string {
  let v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + [...v.slice(1)].map((c) => c + c).join("");
  return v;
}
