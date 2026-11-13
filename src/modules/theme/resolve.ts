/**
 * Combina theme.config.ts (preset) + overrides de la base y genera las variables CSS.
 */
import { defaultPreset, themePresets, type PresetKey } from "../../../theme.config";
import { pickOnColor, relativeLuminance } from "./contrast";
import { FONT_OPTIONS, themeOverridesSchema, themeTokensSchema, type FontKey, type ThemeTokens } from "./tokens";

export { themePresets, defaultPreset, type PresetKey };

export function isPresetKey(v: unknown): v is PresetKey {
  return typeof v === "string" && Object.hasOwn(themePresets, v);
}

/** Nunca falla: valores inválidos en la base se ignoran y se usa el preset. */
export function resolveTheme(preset?: string | null, overrides?: unknown): ThemeTokens {
  const base = themePresets[isPresetKey(preset) ? preset : defaultPreset].tokens;
  const parsed = themeOverridesSchema.safeParse(overrides ?? {});
  const merged = { ...base, ...(parsed.success ? stripUndefined(parsed.data) : {}) };
  return themeTokensSchema.parse(merged);
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Devuelve solo las diferencias respecto del preset (lo que se guarda en la base). */
export function diffFromPreset(preset: PresetKey, tokens: ThemeTokens) {
  const base = themePresets[preset].tokens as ThemeTokens;
  return Object.fromEntries(
    (Object.keys(tokens) as (keyof ThemeTokens)[]).filter((k) => tokens[k] !== base[k]).map((k) => [k, tokens[k]]),
  ) as Partial<ThemeTokens>;
}

export function fontStack(key: FontKey): string {
  const f = FONT_OPTIONS[key];
  return f.cssVar ? `var(${f.cssVar}), ${f.fallback}` : f.fallback;
}

/** Variables CSS del tema (incluye derivadas: texto sobre primario/acento). */
export function themeToCssVars(t: ThemeTokens): Record<string, string> {
  return {
    "--color-primary": t.colorPrimary,
    "--color-accent": t.colorAccent,
    "--color-bg": t.colorBg,
    "--color-surface": t.colorSurface,
    "--color-text": t.colorText,
    "--color-muted": t.colorMuted,
    "--color-on-primary": pickOnColor(t.colorPrimary),
    "--color-on-accent": pickOnColor(t.colorAccent),
    "--radius": `${t.radius}px`,
    "--font-display": fontStack(t.fontDisplay),
    "--font-body": fontStack(t.fontBody),
    "--font-mono": fontStack(t.fontMono),
  };
}

export function themeToCss(t: ThemeTokens, selector = ":root"): string {
  const body = Object.entries(themeToCssVars(t))
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  const scheme = relativeLuminance(t.colorBg) < 0.2 ? "dark" : "light";
  return `${selector}{${body}color-scheme:${scheme};}`;
}
