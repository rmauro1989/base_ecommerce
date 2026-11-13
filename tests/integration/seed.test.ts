import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { isDatabaseEmpty, seedIfEmpty } from "../../prisma/seed-lib";
import { testDb, truncateAll } from "../helpers/db";

const prisma = testDb();
const silent = () => {};

describe("seed", () => {
  beforeAll(async () => {
    process.env.ADMIN_EMAIL = "Dueno@Tienda.cl";
    process.env.ADMIN_PASSWORD = "clave-segura-123";
    process.env.STORE_NAME = "Tienda Test";
    await truncateAll(prisma);
  });
  afterAll(() => prisma.$disconnect());

  it("crea la tienda completa en una base vacía", async () => {
    expect(await isDatabaseEmpty(prisma)).toBe(true);
    expect(await seedIfEmpty(prisma, silent)).toBe(true);

    const settings = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings.storeName).toBe("Tienda Test");
    expect(settings.themePreset).toBe("plano");

    expect(await prisma.product.count()).toBe(12);
    expect(await prisma.product.count({ where: { type: "KIT" } })).toBe(2);
    expect(await prisma.product.count({ where: { status: "PUBLISHED" } })).toBe(12);
    expect(await prisma.category.count()).toBeGreaterThanOrEqual(5);
    expect(await prisma.attributeDefinition.count({ where: { key: { in: ["seccion_mm2", "amperaje", "voltaje", "ip"] } } })).toBe(4);
    expect(await prisma.shippingZone.count({ where: { isFallback: true } })).toBe(1);
    expect(await prisma.homeSection.count()).toBeGreaterThanOrEqual(4);
    expect(await prisma.paymentMethodSetting.count()).toBe(3);

    // Todo producto tiene al menos una variante y una imagen
    const products = await prisma.product.findMany({ include: { variants: true, images: true } });
    for (const p of products) {
      expect(p.variants.length, p.slug).toBeGreaterThan(0);
      expect(p.images.length, p.slug).toBeGreaterThan(0);
    }

    // Kits con componentes
    const kit = await prisma.product.findUniqueOrThrow({ where: { slug: "kit-nuevo-enchufe" }, include: { kitItems: true } });
    expect(kit.kitItems).toHaveLength(5);

    // Producto por metro con largos predefinidos
    const cable = await prisma.product.findUniqueOrThrow({ where: { slug: "cable-thhn-2-5-mm2" } });
    expect(cable.saleUnit).toBe("METER");
    expect(cable.lengthPresets.map(Number)).toEqual([5, 10, 25, 50, 100]);

    // Admin dueño con email normalizado y contraseña hasheada
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email: "dueno@tienda.cl" } });
    expect(admin.role).toBe("OWNER");
    expect(admin.passwordHash).not.toBe("clave-segura-123");
    expect(await bcrypt.compare("clave-segura-123", admin.passwordHash)).toBe(true);
  });

  it("no hace nada si la base ya tiene datos (idempotente)", async () => {
    expect(await seedIfEmpty(prisma, silent)).toBe(false);
    expect(await prisma.product.count()).toBe(12);
    expect(await prisma.adminUser.count()).toBe(1);
  });
});
