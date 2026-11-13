/**
 * Validación de variables de entorno al arrancar (scripts/start.ts).
 * Falla con mensajes claros en vez de errores crípticos en la primera visita.
 */
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

export const envSchema = z
  .object({
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "Debe ser una URL de PostgreSQL (postgresql://…)"),
    AUTH_SECRET: z.string().min(32, "Debe tener al menos 32 caracteres (genera uno con: openssl rand -base64 32)"),
    ADMIN_EMAIL: optional.pipe(z.string().email("Correo inválido").optional()),
    ADMIN_PASSWORD: optional.pipe(z.string().min(8, "Mínimo 8 caracteres").optional()),
    STORE_NAME: optional,
    THEME_PRESET: optional.pipe(z.enum(["plano", "claro", "cobre"], { message: "Usa plano, claro o cobre" }).optional()),
    APP_URL: optional.pipe(z.string().url("Debe ser una URL (https://…)").optional()),
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    SMTP_HOST: optional,
    SMTP_PORT: optional.pipe(z.string().regex(/^\d+$/, "Debe ser un número de puerto").optional()),
  })
  .superRefine((v, ctx) => {
    const s3 = [v.S3_BUCKET, v.S3_ACCESS_KEY_ID, v.S3_SECRET_ACCESS_KEY];
    if (s3.some(Boolean) && !s3.every(Boolean)) {
      ctx.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "Para usar S3 define S3_BUCKET, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY" });
    }
    if (Boolean(v.ADMIN_EMAIL) !== Boolean(v.ADMIN_PASSWORD)) {
      ctx.addIssue({ code: "custom", path: ["ADMIN_PASSWORD"], message: "Define ADMIN_EMAIL y ADMIN_PASSWORD juntos" });
    }
  });

export function checkEnv(env: Record<string, string | undefined> = process.env) {
  const r = envSchema.safeParse(env);
  if (r.success) return { ok: true as const, env: r.data };
  return { ok: false as const, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}
