/**
 * Arranque en producción (Railway):
 *   1. valida variables de entorno
 *   2. aplica migraciones (prisma migrate deploy)
 *   3. carga datos de ejemplo + admin si la base está vacía
 *   4. inicia Next.js en $PORT
 */
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { checkEnv } from "../src/lib/env";
import { seedIfEmpty } from "../prisma/seed-lib";

const require = createRequire(import.meta.url);
const log = (m: string) => console.log(`[start] ${m}`);

async function main() {
  const env = checkEnv();
  if (!env.ok) {
    console.error("[start] ✗ Variables de entorno inválidas:\n  - " + env.errors.join("\n  - "));
    console.error("[start] Revisa .env.example o la pestaña Variables de Railway.");
    process.exit(1);
  }

  log("Aplicando migraciones…");
  const prismaCli = path.join(path.dirname(require.resolve("prisma/package.json")), "build", "index.js");
  const migrate = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit", env: process.env });
  if (migrate.status !== 0) {
    console.error("[start] ✗ Falló prisma migrate deploy.");
    process.exit(migrate.status ?? 1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    await seedIfEmpty(prisma, (m) => console.log(m));
  } finally {
    await prisma.$disconnect();
  }

  const port = process.env.PORT || "3000";
  log(`Iniciando la tienda en el puerto ${port}…`);
  const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", port, "-H", "0.0.0.0"], { stdio: "inherit", env: process.env });
  for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => child.kill(sig));
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error("[start] ✗", e);
  process.exit(1);
});
