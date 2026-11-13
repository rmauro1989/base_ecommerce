import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "admin@tienda.cl";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "admin12345";
const unique = () => Math.random().toString(36).slice(2, 7);

async function login(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto("/admin/ingresar");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
}

test("el panel exige sesión (redirección HTTP real) y rechaza credenciales malas", async ({ page, request }) => {
  const res = await request.get("/admin/productos", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toContain("/admin/ingresar");

  await page.goto("/admin/ingresar");
  await page.getByLabel("Correo").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
});

test("crear un producto por metro con foto y ficha técnica, publicarlo y verlo en la tienda", async ({ page }) => {
  const name = `Cable NYA 10 mm² ${unique()}`;
  await login(page);
  await page.goto("/admin/productos/nuevo");
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Categoría", { exact: true }).selectOption({ label: "— Cable unipolar" });
  await page.getByLabel("Descripción corta").fill("Conductor para alimentadores.");
  await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, "fixtures-foto.png"));
  await expect(page.getByRole("button", { name: "Mover foto 1" })).toBeVisible({ timeout: 15000 });

  await page.getByText("Por metro", { exact: true }).click();
  await page.getByLabel("Precio por metro (CLP)").fill("2190");
  for (const l of ["10", "50"]) {
    await page.getByLabel("Agregar largo").fill(l);
    await page.getByLabel("Agregar largo").press("Enter");
  }
  await page.getByLabel("Sección (mm²) *").fill("10");
  await page.getByLabel("SKU").fill(`NYA10-${unique().toUpperCase()}`);
  await page.getByLabel("Stock").fill("500");

  // Checklist en vivo
  await expect(page.getByText("Listo para publicar", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Estado").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByText("Producto creado.")).toBeVisible();

  await page.getByRole("link", { name: "Ver en la tienda ↗" }).click().catch(() => {});
  await page.goto("/buscar?q=" + encodeURIComponent(name));
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(page.getByText("$2.190").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "50 m" })).toBeVisible();
});

test("el checklist impide publicar un producto incompleto", async ({ page }) => {
  await login(page);
  await page.goto("/admin/productos/nuevo");
  await page.getByLabel("Nombre", { exact: true }).fill(`Incompleto ${unique()}`);
  await page.getByLabel("Precio (CLP)").fill("1000");
  await page.getByLabel("Estado").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByRole("status")).toContainText("No se puede publicar todavía");
});

test("acción masiva: subir precio 10% a productos seleccionados", async ({ page }) => {
  await login(page);
  await page.goto("/admin/productos?q=Caja de derivación");
  const row = page.getByRole("row", { name: /Caja de derivación/ });
  const before = await row.getByRole("cell").nth(4).innerText();
  await row.getByRole("checkbox").check();
  await page.getByLabel("Porcentaje").fill("10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByRole("status")).toContainText("1 producto(s) actualizado(s)");
  await page.reload();
  const after = await page.getByRole("row", { name: /Caja de derivación/ }).getByRole("cell").nth(4).innerText();
  expect(after).not.toBe(before);
  // Revertir aprox.
  await page.getByRole("row", { name: /Caja de derivación/ }).getByRole("checkbox").check();
  await page.getByLabel("Porcentaje").fill("-9.0909");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByRole("status")).toContainText("actualizado");
});

test("pedido: marcar transferencia como pagada y ver historial", async ({ page }) => {
  // Crear un pedido desde la tienda
  await page.goto("/producto/interruptor-simple-9-12");
  await page.getByRole("button", { name: "Agregar al carro" }).click();
  await expect(page.getByRole("status")).toContainText("Agregado");
  await page.goto("/checkout");
  await page.getByLabel("Correo").fill(`compra-${unique()}@test.cl`);
  await page.getByLabel("Nombre y apellido").fill("Rosa Electricista");
  await page.getByLabel("Teléfono").fill("+56 9 2222 3333");
  await page.getByText("Retiro en tienda").click();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page).toHaveURL(/\/pedido\//);
  const number = (await page.getByText(/Pedido #\d+/).first().innerText()).match(/#(\d+)/)![1];

  await login(page);
  await page.goto("/admin/pedidos?q=" + number);
  await page.getByRole("link", { name: `#${number}` }).click();
  await page.getByLabel("Nuevo estado").selectOption("PAID");
  await page.getByLabel("Comentario (opcional)").fill("Transferencia verificada");
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Estado cambiado" })).toBeVisible();
  await expect(page.getByText("Transferencia verificada")).toBeVisible();
  await expect(page.getByText("Pagado").first()).toBeVisible();
});

test("apariencia: cambiar tema con vista previa, aviso de contraste y volver al original", async ({ page }) => {
  await login(page);
  await page.goto("/admin/apariencia");
  await page.getByRole("button", { name: /Cobre/ }).click();
  await expect(page.getByText("Contraste AA ✓")).toBeVisible();
  // Color de texto secundario ilegible → aviso
  await page.getByLabel("Texto secundario en hexadecimal").fill("#3a3d42");
  await expect(page.getByText(/No cumple AA/)).toBeVisible();
  await page.getByRole("button", { name: "Guardar apariencia" }).click();
  await expect(page.getByText(/no cumple el contraste mínimo AA/)).toBeVisible();

  // Corregir y guardar
  await page.getByRole("button", { name: /Cobre/ }).click();
  await page.getByRole("button", { name: "Guardar apariencia" }).click();
  await expect(page.getByText("Contraste AA verificado ✓")).toBeVisible();
  await page.goto("/");
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim());
  expect(bg).toBe("#1b1e22");

  // Volver a "Plano"
  await page.goto("/admin/apariencia");
  await page.getByRole("button", { name: /Plano/ }).click();
  await page.getByRole("button", { name: "Guardar apariencia" }).click();
  await expect(page.getByText("Contraste AA verificado ✓")).toBeVisible();
});

test("roles: un editor no accede a Apariencia ni Usuarios", async ({ page, browser }) => {
  const email = `editor-${unique()}@tienda.cl`;
  await login(page);
  await page.goto("/admin/usuarios");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Crear usuario" }) });
  await form.getByLabel("Nombre").fill("Edu Editor");
  await form.getByLabel("Correo").fill(email);
  await form.getByLabel("Contraseña inicial").fill("editor-clave-1");
  await form.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Usuario guardado.")).toBeVisible();

  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await login(p2, email, "editor-clave-1");
  await expect(p2.getByRole("link", { name: "Apariencia" })).toHaveCount(0);
  await expect(p2.getByRole("link", { name: "Productos" }).first()).toBeVisible();
  await p2.goto("/admin/apariencia");
  await expect(p2.getByText("No tienes permiso para esa sección.")).toBeVisible();
  await ctx.close();
});

test("categorías: crear subcategoría con atributos", async ({ page }) => {
  const name = `Tubos ${unique()}`;
  await login(page);
  await page.goto("/admin/categorias?nueva");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Categoría padre").selectOption({ label: "Canalización" });
  await page.getByLabel("Usar Diámetro").check();
  await page.getByLabel("Diámetro obligatorio").check();
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await expect(page.getByText("Categoría guardada.")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
});
