import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "admin@tienda.cl";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "admin12345";

test("carga masiva: plantilla, mapeo, vista previa con errores y confirmación", async ({ page }) => {
  await page.goto("/admin/ingresar");
  await page.getByLabel("Correo").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

  await page.goto("/admin/importar");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Plantilla Excel (.xlsx)" }).click()]);
  expect(download.suggestedFilename()).toBe("plantilla-productos.xlsx");

  const id = Math.random().toString(36).slice(2, 7).toUpperCase();
  const name = `Interruptor doble ${id}`;
  const csv = [
    "Código;Producto;Categoría;Precio;Stock;Amperaje;Estado;Comentario",
    `INT-${id};${name};interruptores;3.290;40;10;borrador;ok`,
    `INT-${id}-B;Malo ${id};no-existe;abc;5;;;`,
  ].join("\n");
  await page.getByLabel("Archivo de productos").setInputFiles({ name: "productos.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Subir y continuar" }).click();

  // Paso 1: mapeo detectado automáticamente
  await expect(page.getByRole("heading", { name: "¿Qué contiene cada columna?" })).toBeVisible();
  await expect(page.getByLabel("Campo para Código")).toHaveValue("sku");
  await expect(page.getByLabel("Campo para Producto")).toHaveValue("nombre");
  await expect(page.getByLabel("Campo para Amperaje")).toHaveValue("attr:amperaje");
  await expect(page.getByLabel("Campo para Comentario")).toHaveValue("__ignore__");
  await page.getByRole("button", { name: "Continuar a la vista previa" }).click();

  // Paso 2: vista previa
  await expect(page.getByText("Productos nuevos")).toBeVisible();
  await expect(page.getByText("Categoría no encontrada")).toBeVisible();
  await expect(page.getByText(/Precio inválido/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirmar e importar" }).click();

  // Resultado
  await expect(page.getByRole("heading", { name: "Importación completada" })).toBeVisible();
  await expect(page.getByText("Productos creados").locator("..")).toContainText("1");

  await page.goto(`/admin/productos?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name })).toBeVisible();
  await expect(page.getByText(`INT-${id}`)).toBeVisible();
});
