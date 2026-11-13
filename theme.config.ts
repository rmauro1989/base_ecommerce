/**
 * ─────────────────────────────────────────────────────────────
 *  TEMA DE LA TIENDA — única fuente de colores, tipografías y radios.
 * ─────────────────────────────────────────────────────────────
 * Estos valores generan las variables CSS:
 *   --color-primary  --color-accent  --color-bg  --color-surface
 *   --color-text     --color-muted   --radius
 *   --font-display   --font-body     --font-mono
 *
 * Orden de prioridad (de menor a mayor):
 *   1. `defaultPreset` de este archivo
 *   2. Preset elegido (variable THEME_PRESET al crear la tienda o admin > Apariencia)
 *   3. Cambios guardados en admin > Apariencia (base de datos)
 *
 * Para crear una marca nueva basta con editar un preset o agregar uno aquí.
 * Tipografías disponibles: ver FONT_OPTIONS en src/modules/theme/tokens.ts
 */
import type { ThemePreset } from "@/modules/theme/tokens";

export const themePresets = {
  plano: {
    label: "Plano",
    description: "Azul tinta con amarillo eléctrico. Directo y técnico.",
    tokens: {
      colorPrimary: "#16264a",
      colorAccent: "#ffd60a",
      colorBg: "#f6f5f0",
      colorSurface: "#ffffff",
      colorText: "#121826",
      colorMuted: "#545c6b",
      radius: 4,
      fontDisplay: "space-grotesk",
      fontBody: "inter",
      fontMono: "jetbrains-mono",
    },
  },
  claro: {
    label: "Claro",
    description: "Blanco luminoso con azul. Limpio y confiable.",
    tokens: {
      colorPrimary: "#1d5bd6",
      colorAccent: "#0b8fd0",
      colorBg: "#ffffff",
      colorSurface: "#f3f6fb",
      colorText: "#0d1b33",
      colorMuted: "#536179",
      radius: 12,
      fontDisplay: "plus-jakarta",
      fontBody: "inter",
      fontMono: "jetbrains-mono",
    },
  },
  cobre: {
    label: "Cobre",
    description: "Grafito oscuro con naranja cobre. Robusto, de taller.",
    tokens: {
      colorPrimary: "#e0844a",
      colorAccent: "#f2b880",
      colorBg: "#1b1e22",
      colorSurface: "#262a30",
      colorText: "#f2efea",
      colorMuted: "#aaa59d",
      radius: 6,
      fontDisplay: "barlow-condensed",
      fontBody: "barlow",
      fontMono: "ibm-plex-mono",
    },
  },
} satisfies Record<string, ThemePreset>;

export type PresetKey = keyof typeof themePresets;

/** Preset que se usa si no hay nada configurado. */
export const defaultPreset: PresetKey = "plano";

const themeConfig = { presets: themePresets, defaultPreset };
export default themeConfig;
