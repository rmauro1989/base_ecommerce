import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedDatabase } from "../../prisma/seed-lib";
import { db } from "@/lib/db";
import { productFormSchema, type ProductFormInput } from "@/modules/admin/products/schemas";
import { bulkUpdateProducts, getCategoryAttributeFields, ProductValidationError, saveProduct } from "@/modules/admin/products/service";
import { adjustPrice } from "@/modules/admin/products/readiness";
import { placeOrder } from "@/modules/checkout/service";
import { changeOrderStatus, OrderTransitionError } from "@/modules/orders/service";
import type { CheckoutInput } from "@/modules/checkout/schemas";
import { truncateAll } from "../helpers/db";

const silent = () => {};

async function cat(slug: string) {
  return db.category.findUniqueOrThrow({ where: { slug } });
}
async function attr(key: string) {
  return db.attributeDefinition.findUniqueOrThrow({ where: { key } });
}
async function anyAsset() {
  return db.mediaAsset.findFirstOrThrow();
}

async function baseCable(overrides: Partial<ProductFormInput> = {}) {
  const unipolar = await cat("cable-unipolar");
  const seccion = await attr("seccion_mm2");
  const input: ProductFormInput = {
    name: "Cable THHN 6 mm²",
    slug: "",
    type: "SIMPLE",
    status: "DRAFT",
    categoryId: unipolar.id,
    saleUnit: "METER",
    price: 1490,
    lengthPresets: [10, 5, 25],
    allowCustomLength: true,
    minLength: 1,
    maxLength: 50,
    lengthStep: 1,
    shortDescription: "Para alimentadores",
    images: [{ assetId: (await anyAsset()).id, alt: null }],
    variants: [
      { name: "Negro", sku: "THHN60-NG", stock: 300, active: true },
      { name: "Rojo", sku: "THHN60-RJ", stock: 200, active: true, priceOverride: 1590 },
    ],
    attributes: { [seccion.id]: "6" },
    ...overrides,
  };
  return productFormSchema.parse(input);
}

describe("admin: productos", () => {
  beforeEach(async () => {
    await truncateAll(db);
    await seedDatabase(db, silent);
  });
  afterAll(() => db.$disconnect());

  it("los atributos sugeridos incluyen los heredados de la categoría padre", async () => {
    const fields = await getCategoryAttributeFields((await cat("disyuntores")).id);
    const keys = fields.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["amperaje", "polos", "curva", "capacidad_ruptura"]));
    expect(fields.find((f) => f.key === "amperaje")?.required).toBe(true);
  });

  it("crea un producto por metro con variantes, ficha técnica y slug automático", async () => {
    const { id, slug } = await saveProduct(await baseCable());
    expect(slug).toBe("cable-thhn-6-mm2");
    const p = await db.product.findUniqueOrThrow({ where: { id }, include: { variants: { orderBy: { position: "asc" } }, attributes: true, images: true } });
    expect(p.lengthPresets.map(Number)).toEqual([5, 10, 25]);
    expect(p.variants.map((v) => [v.sku, Number(v.stock), v.priceOverride, v.isDefault])).toEqual([
      ["THHN60-NG", 300, null, true],
      ["THHN60-RJ", 200, 1590, false],
    ]);
    expect(Number(p.attributes[0].valueNumber)).toBe(6);
    expect(p.images).toHaveLength(1);

    // Editar: quitar una variante y cambiar el stock de la otra
    const again = await baseCable({ variants: [{ id: p.variants[0].id, name: "Negro", sku: "THHN60-NG", stock: 150, active: true }] });
    await saveProduct(again, id);
    const v = await db.productVariant.findMany({ where: { productId: id } });
    expect(v).toHaveLength(1);
    expect(Number(v[0].stock)).toBe(150);
  });

  it("no permite publicar si falta algo del checklist", async () => {
    const data = await baseCable({ status: "PUBLISHED", images: [], attributes: {} });
    await expect(saveProduct(data)).rejects.toThrow(/Falta: Al menos una foto, Ficha técnica: Sección/);
    expect(await db.product.count({ where: { slug: "cable-thhn-6-mm2" } })).toBe(0);
    const ok = await saveProduct(await baseCable({ status: "PUBLISHED" }));
    expect((await db.product.findUniqueOrThrow({ where: { id: ok.id } })).publishedAt).not.toBeNull();
  });

  it("valida número en la ficha técnica y slug repetido", async () => {
    const seccion = await attr("seccion_mm2");
    await expect(saveProduct(await baseCable({ attributes: { [seccion.id]: "seis" } }))).rejects.toBeInstanceOf(ProductValidationError);
    await expect(saveProduct(await baseCable({ slug: "cable-thhn-2-5-mm2" }))).rejects.toThrow(/slug/);
  });

  it("valida reglas del formulario con Zod", () => {
    const r = productFormSchema.safeParse({ name: "X", slug: "Mal Slug", type: "SIMPLE", status: "DRAFT", saleUnit: "METER", price: 0, variants: [] });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["name", "slug", "price", "variants", "lengthPresets"]));
  });

  it("no borra variantes usadas en kits: las desactiva", async () => {
    const enchufe = await db.product.findUniqueOrThrow({ where: { slug: "enchufe-doble-10a" }, include: { variants: true } });
    const grafito = enchufe.variants.find((v) => v.sku === "ENC10D-GR")!;
    const blanco = enchufe.variants.find((v) => v.sku === "ENC10D-BL")!; // usada en kit
    const enchufes = await cat("enchufes");
    const data = productFormSchema.parse({
      name: enchufe.name,
      slug: enchufe.slug,
      type: "SIMPLE",
      status: "DRAFT",
      categoryId: enchufes.id,
      saleUnit: "UNIT",
      price: enchufe.price,
      variants: [{ id: grafito.id, name: "Grafito", sku: "ENC10D-GR", stock: 60, active: true }],
    });
    await saveProduct(data, enchufe.id);
    const after = await db.productVariant.findUniqueOrThrow({ where: { id: blanco.id } });
    expect(after.active).toBe(false);
  });

  it("acciones masivas: precio %, publicar (con omitidos) y mover categoría", async () => {
    expect(adjustPrice(2490, 10)).toBe(2740);
    expect(adjustPrice(2490, -10, 1)).toBe(2241);
    const cable = await db.product.findUniqueOrThrow({ where: { slug: "cable-thhn-2-5-mm2" }, include: { variants: true } });
    const rollo = await db.product.findUniqueOrThrow({ where: { slug: "cable-thhn-4-mm2-rollo-100m" } });
    await bulkUpdateProducts({ action: "price", ids: [cable.id, rollo.id], percent: 10, roundTo: 10 });
    expect((await db.product.findUniqueOrThrow({ where: { id: cable.id } })).price).toBe(760);
    const r2 = await db.product.findUniqueOrThrow({ where: { id: rollo.id } });
    expect(r2.price).toBe(108890);
    expect(r2.compareAtPrice).toBe(109990); // sigue siendo mayor: se mantiene la oferta

    const draft = await saveProduct(await baseCable({ images: [] })); // sin foto → no publicable
    await bulkUpdateProducts({ action: "hide", ids: [cable.id] });
    const res = await bulkUpdateProducts({ action: "publish", ids: [cable.id, draft.id] });
    expect(res.updated).toBe(1);
    expect(res.skipped).toEqual(["Cable THHN 6 mm²"]);

    const multi = await cat("cable-multiconductor");
    await bulkUpdateProducts({ action: "category", ids: [cable.id], categoryId: multi.id });
    expect((await db.product.findUniqueOrThrow({ where: { id: cable.id } })).categoryId).toBe(multi.id);
  });
});

describe("admin: estados de pedido", () => {
  beforeEach(async () => {
    await truncateAll(db);
    await seedDatabase(db, silent);
  });

  async function order() {
    const v = await db.productVariant.findUniqueOrThrow({ where: { sku: "DIS1P16C" } });
    const token = randomBytes(24).toString("hex");
    await db.cart.create({ data: { token, items: { create: [{ variantId: v.id, quantity: 4 }] } } });
    const input = { email: "a@b.cl", name: "Ana Pérez", phone: "+56911112222", fulfillment: "PICKUP", paymentProvider: "MANUAL_TRANSFER" } as CheckoutInput;
    return placeOrder(input, { cartToken: token });
  }
  const stock = async () => Number((await db.productVariant.findUniqueOrThrow({ where: { sku: "DIS1P16C" } })).stock);

  it("marcar pagado autoriza el pago; cancelar repone stock una sola vez", async () => {
    const before = await stock();
    const o = await order();
    expect(await stock()).toBe(before - 4);
    await changeOrderStatus({ orderId: o.id, to: "PAID", comment: "Transferencia recibida" });
    expect((await db.payment.findFirstOrThrow({ where: { orderId: o.id } })).status).toBe("AUTHORIZED");
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).expiresAt).toBeNull();

    await changeOrderStatus({ orderId: o.id, to: "CANCELLED" });
    expect(await stock()).toBe(before);
    await expect(changeOrderStatus({ orderId: o.id, to: "PAID" })).rejects.toBeInstanceOf(OrderTransitionError);
    expect(await stock()).toBe(before);
    const events = await db.orderStatusEvent.findMany({ where: { orderId: o.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.to)).toEqual(["PENDING_PAYMENT", "PAID", "CANCELLED"]);
  });

  it("reembolso después de despachar no repone stock", async () => {
    const before = await stock();
    const o = await order();
    await changeOrderStatus({ orderId: o.id, to: "PAID" });
    await changeOrderStatus({ orderId: o.id, to: "SHIPPED" });
    await changeOrderStatus({ orderId: o.id, to: "REFUNDED" });
    expect(await stock()).toBe(before - 4);
    expect((await db.payment.findFirstOrThrow({ where: { orderId: o.id } })).status).toBe("REFUNDED");
  });

  it("rechaza transiciones inválidas", async () => {
    const o = await order();
    await expect(changeOrderStatus({ orderId: o.id, to: "DELIVERED" })).rejects.toThrow(/No se puede pasar/);
  });
});
