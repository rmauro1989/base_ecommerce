/**
 * Lógica del seed, reutilizable desde `prisma db seed` y desde el arranque
 * en producción (scripts/start.ts). Solo inserta si la base está vacía.
 */
import bcrypt from "bcryptjs";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { attributes, categories, kits, products, shippingZones } from "./seed-data/catalog";

type Log = (msg: string) => void;

export async function isDatabaseEmpty(prisma: PrismaClient) {
  return (await prisma.storeSettings.count()) === 0;
}

export async function seedIfEmpty(prisma: PrismaClient, log: Log = console.log) {
  if (!(await isDatabaseEmpty(prisma))) {
    log("[seed] La base ya tiene datos: no se ejecuta el seed.");
    return false;
  }
  await seedDatabase(prisma, log);
  return true;
}

export async function seedDatabase(prisma: PrismaClient, log: Log = console.log) {
  const storeName = process.env.STORE_NAME?.trim() || "Mi Tienda Eléctrica";

  await prisma.$transaction(
    async (tx) => {
      // ── Configuración de tienda ──
      await tx.storeSettings.create({
        data: {
          id: 1,
          storeName,
          themePreset: process.env.THEME_PRESET?.trim() || "plano",
          contactEmail: process.env.STORE_CONTACT_EMAIL || process.env.ADMIN_EMAIL || null,
          pickupEnabled: true,
          pickupAddress: "Av. Siempre Viva 742, Santiago",
          pickupInstructions: "Lunes a viernes de 9:00 a 18:00. Presenta tu número de pedido.",
          bankTransferInfo: {
            banco: "Banco de Ejemplo",
            tipoCuenta: "Cuenta corriente",
            numeroCuenta: "00-000-00000-00",
            titular: storeName,
            rut: "76.000.000-0",
            email: process.env.ADMIN_EMAIL ?? "",
          },
          seoDescription: `${storeName}: cables, enchufes, interruptores y protecciones eléctricas.`,
        },
      });

      // ── Secciones del inicio ──
      await tx.homeSection.createMany({
        data: [
          { type: "HERO", position: 0, title: "¿Qué vas a instalar hoy?", subtitle: "Cables, enchufes, interruptores y protecciones con despacho a todo Chile." },
          { type: "CATEGORIES", position: 1, title: "Categorías" },
          { type: "KITS", position: 2, title: "Kits por proyecto", subtitle: "Todo lo que necesitas, en un solo carro." },
          { type: "BESTSELLERS", position: 3, title: "Más vendidos", config: { limit: 8 } },
          { type: "FEATURED", position: 4, title: "Destacados", enabled: false, config: { limit: 4 } },
        ],
      });

      // ── Medios de pago (las credenciales van en variables de entorno) ──
      await tx.paymentMethodSetting.createMany({
        data: [
          { provider: "WEBPAY", enabled: true, displayName: "Webpay (débito, crédito y prepago)", position: 0 },
          { provider: "MERCADOPAGO", enabled: true, displayName: "Mercado Pago", position: 1 },
          {
            provider: "MANUAL_TRANSFER",
            enabled: true,
            displayName: "Transferencia bancaria",
            instructions: "Transfiere el total indicando tu número de pedido. Lo confirmamos dentro de 24 horas hábiles.",
            position: 2,
          },
        ],
      });

      // ── Zonas de despacho ──
      await tx.shippingZone.createMany({
        data: shippingZones.map((z, i) => ({ ...z, position: i })),
      });

      // ── Atributos técnicos ──
      const attrIds = new Map<string, string>();
      for (const [i, a] of attributes.entries()) {
        const created = await tx.attributeDefinition.create({
          data: { key: a.key, label: a.label, type: a.type, unit: a.unit, options: a.options ?? [], filterable: a.filterable ?? true, position: i },
        });
        attrIds.set(a.key, created.id);
      }

      // ── Categorías (padres antes que hijos) ──
      const catIds = new Map<string, string>();
      for (const [i, c] of categories.entries()) {
        const created = await tx.category.create({
          data: {
            slug: c.slug,
            name: c.name,
            description: c.description,
            position: i,
            parentId: c.parent ? catIds.get(c.parent) : undefined,
            attributes: {
              create: (c.attributes ?? []).map(([key, required], pos) => ({ attributeId: attrIds.get(key)!, required, position: pos })),
            },
          },
        });
        catIds.set(c.slug, created.id);
      }

      // ── Productos ──
      const productIds = new Map<string, string>();
      const variantIdsBySku = new Map<string, string>();
      const now = new Date();

      for (const p of products) {
        const image = await tx.mediaAsset.create({
          data: { key: `seed/${p.slug}.svg`, url: `/seed/${p.slug}.svg`, mimeType: "image/svg+xml", size: 0, width: 800, height: 800 },
        });
        const variants = p.variants ?? [{ sku: p.sku!, name: "Por defecto", stock: p.stock ?? 0, options: undefined }];
        const created = await tx.product.create({
          data: {
            slug: p.slug,
            name: p.name,
            brand: p.brand,
            shortDescription: p.shortDescription,
            description: p.description,
            status: "PUBLISHED",
            publishedAt: now,
            categoryId: catIds.get(p.category),
            saleUnit: p.saleUnit,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
            lengthPresets: (p.lengthPresets ?? []).map((n) => new Prisma.Decimal(n)),
            allowCustomLength: p.allowCustomLength ?? false,
            minLength: p.minLength,
            maxLength: p.maxLength,
            lengthStep: p.lengthStep,
            packContent: p.packContent,
            packLabel: p.packLabel,
            featured: p.featured ?? false,
            soldCount: p.soldCount ?? 0,
            images: { create: [{ assetId: image.id, position: 0, alt: p.name }] },
            variants: {
              create: variants.map((v, i) => ({
                sku: v.sku,
                name: v.name,
                options: v.options,
                stock: v.stock,
                isDefault: i === 0,
                position: i,
              })),
            },
            attributes: {
              create: Object.entries(p.attributes).map(([key, value]) => ({
                attributeId: attrIds.get(key)!,
                valueNumber: typeof value === "number" ? value : undefined,
                valueText: typeof value === "string" ? value : undefined,
                valueBool: typeof value === "boolean" ? value : undefined,
              })),
            },
          },
          include: { variants: true },
        });
        productIds.set(p.slug, created.id);
        for (const v of created.variants) if (v.sku) variantIdsBySku.set(v.sku, v.id);
      }

      // ── Relaciones "Se conecta con" ──
      for (const p of products) {
        for (const [pos, to] of (p.connectsWith ?? []).entries()) {
          await tx.productRelation.create({
            data: { fromId: productIds.get(p.slug)!, toId: productIds.get(to)!, type: "CONNECTS_WITH", position: pos },
          });
        }
      }

      // ── Kits ──
      for (const k of kits) {
        const image = await tx.mediaAsset.create({
          data: { key: `seed/${k.slug}.svg`, url: `/seed/${k.slug}.svg`, mimeType: "image/svg+xml", size: 0, width: 800, height: 800 },
        });
        await tx.product.create({
          data: {
            slug: k.slug,
            name: k.name,
            type: "KIT",
            status: "PUBLISHED",
            publishedAt: now,
            categoryId: catIds.get(k.category),
            saleUnit: "UNIT",
            price: k.price,
            shortDescription: k.shortDescription,
            description: k.description,
            soldCount: k.soldCount ?? 0,
            featured: true,
            images: { create: [{ assetId: image.id, position: 0, alt: k.name }] },
            // Variante técnica: los kits no tienen stock propio (se calcula desde componentes)
            variants: { create: [{ name: "Por defecto", isDefault: true, stock: 0 }] },
            kitItems: {
              create: k.items.map(([sku, quantity], pos) => {
                const variantId = variantIdsBySku.get(sku);
                if (!variantId) throw new Error(`[seed] Kit ${k.slug}: SKU ${sku} no existe`);
                return { variantId, quantity, position: pos };
              }),
            },
          },
        });
      }

      // ── Usuario administrador (dueño) ──
      const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD;
      if (email && password) {
        if (password.length < 8) throw new Error("[seed] ADMIN_PASSWORD debe tener al menos 8 caracteres");
        await tx.adminUser.create({
          data: { email, name: "Administrador", role: "OWNER", passwordHash: await bcrypt.hash(password, 12) },
        });
      } else {
        log("[seed] ⚠ ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se creó usuario admin.");
      }
    },
    { timeout: 60_000 },
  );

  log(`[seed] Tienda "${storeName}" creada: ${categories.length} categorías, ${attributes.length} atributos, ${products.length + kits.length} productos (${kits.length} kits).`);
}
