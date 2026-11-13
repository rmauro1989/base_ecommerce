import { describe, expect, it } from "vitest";
import { checkThemeContrast, contrastFailures, contrastRatio, pickOnColor } from "@/modules/theme/contrast";
import { diffFromPreset, resolveTheme, themePresets, themeToCss, themeToCssVars } from "@/modules/theme/resolve";
import { themeTokensSchema } from "@/modules/theme/tokens";

describe("contraste WCAG", () => {
  it("calcula los valores de referencia", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#fff", "#000")).toBe(contrastRatio("#000000", "#ffffff"));
  });

  it("elige texto oscuro sobre amarillo y claro sobre azul oscuro", () => {
    expect(pickOnColor("#ffd60a")).toBe("#111418");
    expect(pickOnColor("#16264a")).toBe("#ffffff");
  });

  it("detecta un tema que no cumple AA", () => {
    const bad = resolveTheme("claro", { colorMuted: "#b0b0b0", colorPrimary: "#7fb2ff" });
    const ids = contrastFailures(bad).map((f) => f.id);
    expect(ids).toContain("muted-bg");
    expect(ids).toContain("primary-bg");
  });
});

describe("presets incluidos", () => {
  for (const [key, preset] of Object.entries(themePresets)) {
    it(`"${key}" es válido y cumple contraste AA`, () => {
      expect(() => themeTokensSchema.parse(preset.tokens)).not.toThrow();
      const failures = checkThemeContrast(preset.tokens).filter((c) => !c.pass);
      expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    });
  }
});

describe("resolveTheme", () => {
  it("usa el preset por defecto si no hay nada", () => {
    expect(resolveTheme()).toEqual(themePresets.plano.tokens);
  });

  it("aplica overrides de la base sobre el preset", () => {
    const t = resolveTheme("cobre", { colorPrimary: "#ABC", radius: 10 });
    expect(t.colorPrimary).toBe("#aabbcc");
    expect(t.radius).toBe(10);
    expect(t.colorBg).toBe(themePresets.cobre.tokens.colorBg);
  });

  it("ignora overrides inválidos y presets inexistentes", () => {
    expect(resolveTheme("no-existe", { colorPrimary: "rojo" })).toEqual(themePresets.plano.tokens);
  });

  it("diffFromPreset guarda solo lo modificado", () => {
    const t = { ...themePresets.claro.tokens, radius: 0 };
    expect(diffFromPreset("claro", t)).toEqual({ radius: 0 });
  });
});

describe("variables CSS", () => {
  it("genera todas las variables requeridas", () => {
    const vars = themeToCssVars(themePresets.plano.tokens);
    for (const v of ["--color-primary", "--color-accent", "--color-bg", "--color-surface", "--color-text", "--color-muted", "--radius", "--font-display", "--font-body", "--font-mono"]) {
      expect(vars[v], v).toBeTruthy();
    }
    expect(vars["--radius"]).toBe("4px");
    expect(vars["--font-body"]).toMatch(/^var\(--ff-inter\)/);
  });

  it("serializa a una regla CSS", () => {
    expect(themeToCss(themePresets.plano.tokens)).toMatch(/^:root\{--color-primary:#16264a;/);
  });
});
