import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const COLOR_MSG =
  "Colores fijos prohibidos: usa los tokens del tema (bg-primary, text-muted, border-border…). Ver theme.config.ts";
const PALETTE =
  "(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)";
const UTIL = "(bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|shadow|accent|caret|divide|placeholder)";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", ".pgdata/**"]),
  {
    // Ningún componente usa colores fijos (excepto el propio módulo de tema).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/modules/theme/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Literal[value=/#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\\b/]", message: COLOR_MSG },
        { selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?\\b/]", message: COLOR_MSG },
        { selector: "Literal[value=/\\b(rgba?|hsla?|oklch|oklab)\\(/]", message: COLOR_MSG },
        { selector: "TemplateElement[value.raw=/\\b(rgba?|hsla?|oklch|oklab)\\(/]", message: COLOR_MSG },
        { selector: `Literal[value=/\\b${UTIL}-${PALETTE}(-\\d{2,3})?\\b/]`, message: COLOR_MSG },
        { selector: `TemplateElement[value.raw=/\\b${UTIL}-${PALETTE}(-\\d{2,3})?\\b/]`, message: COLOR_MSG },
      ],
    },
  },
]);

export default eslintConfig;
