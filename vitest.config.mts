import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    // Los tests de integración comparten la base tienda_test
    fileParallelism: false,
  },
});
