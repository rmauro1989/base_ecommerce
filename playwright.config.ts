import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas end-to-end contra una tienda corriendo (por defecto http://localhost:3000).
 * Usa el Chrome instalado en el equipo (no descarga navegadores).
 *   E2E_BASE_URL=http://localhost:3101 npm run e2e
 * Requiere la base con el seed de ejemplo.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    locale: "es-CL",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, grep: /@mobile/ },
  ],
});
