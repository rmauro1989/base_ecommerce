/**
 * Postgres local sin Docker (binarios vía npm `embedded-postgres`).
 * Uso: `npm run db` (deja el proceso corriendo). Datos en ./.pgdata
 * Crea las bases `tienda` (desarrollo) y `tienda_test` (tests).
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".pgdata");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "tienda",
  password: "tienda",
  port: 5433,
  persistent: true,
});

async function main() {
  const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
  if (fresh) await pg.initialise();
  await pg.start();
  for (const db of ["tienda", "tienda_test"]) {
    try {
      await pg.createDatabase(db);
    } catch {
      /* ya existe */
    }
  }
  console.log("Postgres listo en postgresql://tienda:tienda@localhost:5433/tienda (Ctrl+C para detener)");
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
