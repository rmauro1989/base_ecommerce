/** Aplica las migraciones a la base de tests antes de correr la suite. */
import { execSync } from "node:child_process";
import "dotenv/config";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://tienda:tienda@localhost:5433/tienda_test";
  process.env.TEST_DATABASE_URL = url;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
