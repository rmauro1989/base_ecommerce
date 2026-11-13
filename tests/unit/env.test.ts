import { describe, expect, it } from "vitest";
import { checkEnv } from "@/lib/env";

const base = { DATABASE_URL: "postgresql://u:p@h:5432/db", AUTH_SECRET: "x".repeat(32) };

describe("variables de entorno", () => {
  it("acepta la configuración mínima", () => {
    expect(checkEnv(base).ok).toBe(true);
  });
  it("explica qué falta o está mal", () => {
    const r = checkEnv({ DATABASE_URL: "mysql://x", AUTH_SECRET: "corto", THEME_PRESET: "rosado", S3_BUCKET: "b", ADMIN_EMAIL: "a@b.cl" });
    expect(r.ok).toBe(false);
    const msg = !r.ok ? r.errors.join("\n") : "";
    expect(msg).toMatch(/DATABASE_URL: Debe ser una URL de PostgreSQL/);
    expect(msg).toMatch(/AUTH_SECRET: Debe tener al menos 32/);
    expect(msg).toMatch(/THEME_PRESET: Usa plano, claro o cobre/);
  });
  it("valida combinaciones (S3 completo, admin completo)", () => {
    const r = checkEnv({ ...base, S3_BUCKET: "b", ADMIN_EMAIL: "a@b.cl" });
    const msg = !r.ok ? r.errors.join("\n") : "";
    expect(msg).toMatch(/S3_BUCKET: Para usar S3/);
    expect(msg).toMatch(/ADMIN_PASSWORD: Define ADMIN_EMAIL y ADMIN_PASSWORD juntos/);
  });
  it("trata variables vacías como no definidas", () => {
    expect(checkEnv({ ...base, ADMIN_EMAIL: "", ADMIN_PASSWORD: "", APP_URL: "  " }).ok).toBe(true);
  });
});
