/**
 * Contraste WCAG 2.x. AA = 4.5:1 para texto normal, 3:1 para texto grande
 * y componentes de interfaz.
 */
import { COLOR_LABELS, normalizeHex, type ThemeTokens } from "./tokens";

const ON_LIGHT = "#111418";
const ON_DARK = "#ffffff";

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Color de texto (claro u oscuro) con mejor contraste sobre `background`. */
export function pickOnColor(background: string): string {
  return contrastRatio(background, ON_DARK) >= contrastRatio(background, ON_LIGHT) ? ON_DARK : ON_LIGHT;
}

export type ContrastCheck = {
  id: string;
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  required: number;
  pass: boolean;
};

/**
 * Pares que la interfaz realmente usa. Regla de diseño: el acento nunca se usa
 * como color de texto sobre el fondo, solo como fondo con su color "sobre acento".
 */
export function checkThemeContrast(t: ThemeTokens): ContrastCheck[] {
  const onPrimary = pickOnColor(t.colorPrimary);
  const onAccent = pickOnColor(t.colorAccent);
  const pairs: Omit<ContrastCheck, "ratio" | "pass">[] = [
    { id: "text-bg", label: `${COLOR_LABELS.colorText} sobre ${COLOR_LABELS.colorBg.toLowerCase()}`, foreground: t.colorText, background: t.colorBg, required: 4.5 },
    { id: "text-surface", label: `${COLOR_LABELS.colorText} sobre ${COLOR_LABELS.colorSurface.toLowerCase()}`, foreground: t.colorText, background: t.colorSurface, required: 4.5 },
    { id: "muted-bg", label: `${COLOR_LABELS.colorMuted} sobre ${COLOR_LABELS.colorBg.toLowerCase()}`, foreground: t.colorMuted, background: t.colorBg, required: 4.5 },
    { id: "muted-surface", label: `${COLOR_LABELS.colorMuted} sobre ${COLOR_LABELS.colorSurface.toLowerCase()}`, foreground: t.colorMuted, background: t.colorSurface, required: 4.5 },
    { id: "primary-bg", label: "Enlaces (primario) sobre fondo", foreground: t.colorPrimary, background: t.colorBg, required: 4.5 },
    { id: "primary-surface", label: "Enlaces (primario) sobre superficie", foreground: t.colorPrimary, background: t.colorSurface, required: 4.5 },
    { id: "on-primary", label: "Texto de botón sobre primario", foreground: onPrimary, background: t.colorPrimary, required: 4.5 },
    { id: "on-accent", label: "Texto sobre acento", foreground: onAccent, background: t.colorAccent, required: 4.5 },
  ];
  return pairs.map((p) => {
    const ratio = Math.round(contrastRatio(p.foreground, p.background) * 100) / 100;
    return { ...p, ratio, pass: ratio >= p.required };
  });
}

export function contrastFailures(t: ThemeTokens) {
  return checkThemeContrast(t).filter((c) => !c.pass);
}
