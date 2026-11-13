import { expect, test } from "@playwright/test";

const unique = () => Math.random().toString(36).slice(2, 8);

test("buscar, elegir medida exacta por metro, comprar como invitado con despacho", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("¿Qué vas a instalar hoy?");

  await page.getByRole("searchbox").first().fill("THHN 2,5");
  await page.getByRole("button", { name: "Buscar" }).first().click();
  await expect(page).toHaveURL(/\/buscar\?q=/);
  await page.getByRole("link", { name: /Cable THHN 2,5/ }).first().click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cable THHN 2,5 mm²");
  await page.getByRole("button", { name: "Negro" }).click();
  await page.getByRole("button", { name: "Medida exacta" }).click();
  await page.getByLabel("Largo exacto en metros").fill("7,3");
  await expect(page.getByText(/múltiplo de 0,5/)).toBeVisible();
  await page.getByLabel("Largo exacto en metros").fill("7,5");
  await page.getByRole("button", { name: "Sumar" }).click(); // 2 piezas
  await expect(page.getByText("$10.350")).toBeVisible(); // 2 × 7,5 m × $690
  await page.getByRole("button", { name: "Agregar al carro" }).click();
  await expect(page.getByRole("status")).toContainText("Agregado al carro");

  await page.goto("/carrito");
  await expect(page.getByText("7,5 m por pieza")).toBeVisible();
  await page.getByRole("link", { name: "Continuar con la compra" }).click();

  await page.getByLabel("Correo").fill(`invitado-${unique()}@test.cl`);
  await page.getByLabel("Nombre y apellido").fill("Juana Pérez");
  await page.getByLabel("Teléfono").fill("+56 9 8765 4321");
  await page.getByLabel("Comuna", { exact: true }).selectOption("Ñuñoa");
  await expect(page.getByRole("status").filter({ hasText: "Santiago centro" })).toContainText("$3.990");
  await page.getByLabel("Calle").fill("Irarrázaval");
  await page.getByLabel("Número", { exact: true }).fill("100");
  await page.getByText("Transferencia bancaria").click();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();

  await expect(page).toHaveURL(/\/pedido\/.+\?nuevo=1/);
  await expect(page.getByRole("heading", { name: "¡Gracias por tu compra!" })).toBeVisible();
  await expect(page.getByText("Transfiere $14.340 para confirmar tu pedido")).toBeVisible();
});

test("validaciones del checkout", async ({ page }) => {
  await page.goto("/producto/disyuntor-1p-16a-curva-c");
  await page.getByRole("button", { name: "Agregar al carro" }).click();
  await expect(page.getByRole("status")).toContainText("Agregado");
  await page.goto("/checkout");
  await page.getByLabel("RUT (opcional)").fill("12.345.678-0");
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page.getByText("Revisa los datos marcados.")).toBeVisible();
  await expect(page.getByText("Correo inválido")).toBeVisible();
  await expect(page.getByText("RUT inválido")).toBeVisible();
  await expect(page.getByText("Elige la comuna")).toBeVisible();
});

test("filtros técnicos del catálogo", async ({ page }) => {
  await page.goto("/categoria/protecciones");
  await expect(page.getByText("3 productos")).toBeVisible(); // disyuntor, diferencial, kit tablero
  await page.locator("aside").getByRole("link", { name: /^C\s*1$/ }).click();
  await expect(page).toHaveURL(/f\.curva=C/);
  await expect(page.getByText("1 producto", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Disyuntor 1P 16 A/ })).toBeVisible();
  await page.getByRole("link", { name: "Limpiar filtros" }).click();
  await expect(page.getByText("3 productos")).toBeVisible();
});

test("crear cuenta, comprar un kit con retiro y verlo en Mis pedidos", async ({ page }) => {
  const email = `cliente-${unique()}@test.cl`;
  await page.goto("/cuenta/registro");
  await page.getByLabel("Nombre y apellido").fill("Pedro Instalador");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-1");
  await page.getByLabel("Repite la contraseña").fill("clave-segura-1");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { name: "Hola, Pedro" })).toBeVisible();

  await page.goto("/producto/kit-tablero-basico");
  await expect(page.getByText("Qué incluye el kit")).toBeVisible();
  await page.getByRole("button", { name: "Agregar al carro" }).click();
  await expect(page.getByRole("status")).toContainText("Agregado");
  await page.goto("/checkout");
  await expect(page.getByLabel("Correo")).toHaveValue(email);
  await page.getByLabel("Teléfono").fill("+56 9 1111 2222");
  await page.getByText("Retiro en tienda").click();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await expect(page).toHaveURL(/\/pedido\//);
  await expect(page.getByText("$35.990").first()).toBeVisible();

  await page.goto("/cuenta");
  await expect(page.getByText(/Pedido #\d+/).first()).toBeVisible();
  await expect(page.getByText("Pendiente de pago").first()).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/cuenta\/ingresar/);
});

test("móvil: inicio, menú y ficha @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.goto("/producto/cable-thhn-2-5-mm2");
  const w2 = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w2).toBeLessThanOrEqual(page.viewportSize()!.width);
});
