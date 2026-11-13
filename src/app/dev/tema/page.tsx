import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { ThemeSample } from "@/modules/theme/components/theme-sample";
import { checkThemeContrast } from "@/modules/theme/contrast";
import { themePresets, themeToCss } from "@/modules/theme/resolve";
import { FONT_OPTIONS } from "@/modules/theme/tokens";

export const metadata = { title: "Temas (desarrollo)" };

// Página de desarrollo: los 3 presets lado a lado con su verificación de contraste.
export default async function ThemeDevPage() {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_PAGES !== "true") notFound();

  const presets = Object.entries(themePresets);
  return (
    <main className="py-10">
      <style>{presets.map(([key, p]) => themeToCss(p.tokens, `[data-preview="${key}"]`)).join("\n")}</style>
      <Container className="max-w-none">
        <h1 className="text-3xl font-bold">Temas incluidos</h1>
        <p className="mt-1 text-muted">
          Definidos en <code className="font-mono">theme.config.ts</code>. Cada columna aplica sus variables CSS a un contenedor.
        </p>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {presets.map(([key, p]) => {
            const checks = checkThemeContrast(p.tokens);
            const ok = checks.every((c) => c.pass);
            return (
              <section key={key} data-theme-scope data-preview={key} className="rounded-xl p-4">
                <div className="mb-4 flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-xl font-bold">{p.label}</h2>
                  <Badge tone={ok ? "success" : "danger"}>{ok ? "Contraste AA ✓" : "No cumple AA"}</Badge>
                </div>
                <p className="mb-4 text-sm text-muted">{p.description}</p>
                <ThemeSample />
                <table className="mt-4 w-full font-mono text-xs">
                  <tbody>
                    {checks.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="py-1 pr-2">{c.label}</td>
                        <td className={c.pass ? "py-1 text-right" : "py-1 text-right text-danger"}>
                          {c.ratio.toFixed(2)}:1 {c.pass ? "✓" : "✗"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 font-mono text-xs text-muted">
                  {FONT_OPTIONS[p.tokens.fontDisplay].label} / {FONT_OPTIONS[p.tokens.fontBody].label} / radio {p.tokens.radius}px
                </p>
              </section>
            );
          })}
        </div>
      </Container>
    </main>
  );
}
