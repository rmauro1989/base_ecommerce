import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../../prisma/seed-lib";
import { db } from "@/lib/db";
import { CheckoutError, placeOrder, releaseExpiredOrders } from "@/modules/checkout/service";
import type { CheckoutInput } from "@/modules/checkout/schemas";
import { truncateAll } from "../helpers/db";

const silent = () => {};

const baseInput: CheckoutInput = {
  email: "cliente@test.cl",
  name: "Cliente de Prueba",
  phone: "+56 9 1234 5678",
  fulfillment: "SHIPPING",
  region: "Metropolitana de Santiago",
  comuna: "Ñuñoa",
  street: "Irarrázaval",
  number: "1234",
  paymentProvider: "MANUAL_TRANSFER",
} as CheckoutInput;

async function variantBySku(sku: string) {
  return db.productVariant.findUniqueOrThrow({ where: { sku } });
}

async function kitVariant(slug: string) {
  return db.productVariant.findFirstOrThrow({ where: { product: { slug } } });
}

async function makeCart(items: { variantId: string; quantity: number; length?: number }[]) {
  const token = randomBytes(24).toString("hex");
  await db.cart.create({ data: { token, items: { create: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, length: i.length ?? null })) } } });
  return token;
}

const stockOf = async (sku: string) => Number((await variantBySku(sku)).stock);

describe("checkout", () => {
  beforeEach(async () => {
    await truncateAll(db);
    await seedDatabase(db, silent);
  });
  afterAll(() => db.$disconnect());

  it("crea el pedido con precios del servidor, descuenta stock (metros, unidades y kits) y vacía el carro", async () => {
    const cable = await variantBySku("THHN25-RJ");
    const enchufe = await variantBySku("ENC10D-BL");
    const kit = await kitVariant("kit-nuevo-enchufe");
    const token = await makeCart([
      { variantId: cable.id, quantity: 2, length: 7.5 }, // 2 piezas de 7,5 m = 15 m · $690/m → 2 × 5.175
      { variantId: enchufe.id, quantity: 3 }, // 3 × 2.490
      { variantId: kit.id, quantity: 1 }, // kit $19.990: 10 m rojo + 10 m blanco + 10 m v/a + enchufe + caja
    ]);
    const before = { rojo: await stockOf("THHN25-RJ"), blanco: await stockOf("THHN25-BL"), enchufe: await stockOf("ENC10D-BL"), caja: await stockOf("CAJ100-IP55") };

    const order = await placeOrder(baseInput, { cartToken: token });

    const subtotal = 2 * 5175 + 3 * 2490 + 19990;
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, payments: true, events: true } });
    expect(saved.subtotal).toBe(subtotal);
    expect(saved.shippingCost).toBe(3990); // Ñuñoa: zona centro, bajo el mínimo de despacho gratis
    expect(saved.total).toBe(subtotal + 3990);
    expect(saved.status).toBe("PENDING_PAYMENT");
    expect(saved.items).toHaveLength(3);
    expect(saved.items.find((i) => i.sku === "THHN25-RJ")?.lineTotal).toBe(10350);
    expect(saved.items.find((i) => i.name.startsWith("Kit"))?.kitSnapshot).toHaveLength(5);
    expect(saved.payments[0]).toMatchObject({ provider: "MANUAL_TRANSFER", status: "PENDING", amount: subtotal + 3990 });
    expect(saved.events[0].to).toBe("PENDING_PAYMENT");
    expect(saved.expiresAt!.getTime()).toBeGreaterThan(Date.now());

    expect(await stockOf("THHN25-RJ")).toBe(before.rojo - 15 - 10);
    expect(await stockOf("THHN25-BL")).toBe(before.blanco - 10);
    expect(await stockOf("ENC10D-BL")).toBe(before.enchufe - 3 - 1);
    expect(await stockOf("CAJ100-IP55")).toBe(before.caja - 1);

    expect(await db.cartItem.count({ where: { cart: { token } } })).toBe(0);
    const kitProduct = await db.product.findUniqueOrThrow({ where: { slug: "kit-nuevo-enchufe" } });
    expect(kitProduct.soldCount).toBe(95 + 1);
  });

  it("aplica despacho gratis sobre el monto mínimo de la zona", async () => {
    const rollo = await variantBySku("THHN40-R100");
    const token = await makeCart([{ variantId: rollo.id, quantity: 1 }]); // $98.990 ≥ $60.000
    const order = await placeOrder(baseInput, { cartToken: token });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).shippingCost).toBe(0);
  });

  it("usa la zona por defecto para comunas no listadas y retiro sin costo", async () => {
    const v = await variantBySku("DIS1P16C");
    const t1 = await makeCart([{ variantId: v.id, quantity: 1 }]);
    const o1 = await placeOrder({ ...baseInput, region: "Biobío", comuna: "Concepción" }, { cartToken: t1 });
    expect((await db.order.findUniqueOrThrow({ where: { id: o1.id } })).shippingCost).toBe(9990);

    const t2 = await makeCart([{ variantId: v.id, quantity: 1 }]);
    const o2 = await placeOrder({ ...baseInput, fulfillment: "PICKUP" }, { cartToken: t2 });
    const saved = await db.order.findUniqueOrThrow({ where: { id: o2.id } });
    expect(saved.shippingCost).toBe(0);
    expect(saved.total).toBe(4990);
    expect(saved.shippingAddress).toBeNull();
  });

  it("no vende más de lo que hay aunque dos clientes compren a la vez", async () => {
    const v = await variantBySku("DIF2P25-30");
    await db.productVariant.update({ where: { id: v.id }, data: { stock: 1 } });
    const [a, b] = [await makeCart([{ variantId: v.id, quantity: 1 }]), await makeCart([{ variantId: v.id, quantity: 1 }])];
    const results = await Promise.allSettled([placeOrder(baseInput, { cartToken: a }), placeOrder(baseInput, { cartToken: b })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(CheckoutError);
    expect(await stockOf("DIF2P25-30")).toBe(0);
    expect(await db.order.count()).toBe(1);
  });

  it("rechaza carro vacío, sin stock o medio de pago desactivado", async () => {
    const empty = await makeCart([]);
    await expect(placeOrder(baseInput, { cartToken: empty })).rejects.toThrow(/vacío/);

    const v = await variantBySku("ENC16-IP44");
    const tooMany = await makeCart([{ variantId: v.id, quantity: 999 }]);
    await expect(placeOrder(baseInput, { cartToken: tooMany })).rejects.toThrow(/quedan/);

    await db.paymentMethodSetting.update({ where: { provider: "MANUAL_TRANSFER" }, data: { enabled: false } });
    const ok = await makeCart([{ variantId: v.id, quantity: 1 }]);
    await expect(placeOrder(baseInput, { cartToken: ok })).rejects.toThrow(/medio de pago/);
    expect(await db.order.count()).toBe(0);
  });

  it("libera el stock de pedidos impagos vencidos (una sola vez)", async () => {
    const kit = await kitVariant("kit-tablero-basico"); // 1 diferencial + 3 disyuntores
    const token = await makeCart([{ variantId: kit.id, quantity: 2 }]);
    const before = { dif: await stockOf("DIF2P25-30"), dis: await stockOf("DIS1P16C") };
    const order = await placeOrder({ ...baseInput, fulfillment: "PICKUP" }, { cartToken: token });
    expect(await stockOf("DIS1P16C")).toBe(before.dis - 6);

    const future = new Date(Date.now() + 49 * 3600_000);
    expect(await releaseExpiredOrders(future)).toBe(1);
    expect(await releaseExpiredOrders(future)).toBe(0);
    expect(await stockOf("DIF2P25-30")).toBe(before.dif);
    expect(await stockOf("DIS1P16C")).toBe(before.dis);
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(saved.status).toBe("CANCELLED");
    expect(saved.payments[0].status).toBe("CANCELLED");
  });
});
