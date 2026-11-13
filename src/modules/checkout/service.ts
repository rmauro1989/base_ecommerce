import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { kitStockRequired, stockRequired } from "@/modules/catalog/pricing";
import { buildCartLines, variantForCartInclude, type CartLine } from "@/modules/cart/service";
import { getProvider } from "@/modules/payments/registry";
import type { CheckoutInput } from "./schemas";
import { findZoneForComuna, shippingCost } from "./shipping";

export class CheckoutError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export type ShippingQuote = { zoneId: string; zoneName: string; cost: number; estimatedDays: string | null; freeShippingOver: number | null };

export async function quoteShipping(comuna: string, subtotal: number): Promise<ShippingQuote | null> {
  const zones = await db.shippingZone.findMany({ orderBy: { position: "asc" } });
  const zone = findZoneForComuna(zones, comuna);
  if (!zone) return null;
  return { zoneId: zone.id, zoneName: zone.name, cost: shippingCost(zone, subtotal), estimatedDays: zone.estimatedDays, freeShippingOver: zone.freeShippingOver };
}

/** Carga y re-precia el carrito desde la base (nunca se confía en el navegador). */
export async function loadCartForCheckout(cartToken: string) {
  const cart = await db.cart.findUnique({ where: { token: cartToken }, include: { items: { orderBy: { createdAt: "asc" } } } });
  if (!cart || cart.items.length === 0) throw new CheckoutError("Tu carro está vacío.");
  const variants = await db.productVariant.findMany({ where: { id: { in: cart.items.map((i) => i.variantId) } }, include: variantForCartInclude });
  const lines = buildCartLines(
    cart.items.map((i) => ({ id: i.id, variantId: i.variantId, quantity: i.quantity, length: i.length == null ? null : Number(i.length) })),
    variants,
  );
  const problem = lines.find((l) => l.problem);
  if (problem) throw new CheckoutError(`${problem.name}: ${problem.problem}`);
  return { cart, lines, variants };
}

type StockNeed = { variantId: string; amount: number; label: string };

/** Suma lo que cada variante debe descontar (los kits descuentan sus componentes). */
export function computeStockNeeds(lines: CartLine[], kitItemsByVariant: Map<string, { variantId: string; quantity: number }[]>): StockNeed[] {
  const needs = new Map<string, StockNeed>();
  const add = (variantId: string, amount: number, label: string) => {
    const n = needs.get(variantId);
    if (n) n.amount = Math.round((n.amount + amount) * 100) / 100;
    else needs.set(variantId, { variantId, amount, label });
  };
  for (const l of lines) {
    if (l.type === "KIT") {
      for (const c of kitStockRequired(kitItemsByVariant.get(l.variantId) ?? [], l.quantity)) add(c.variantId, c.amount, l.name);
    } else {
      add(l.variantId, stockRequired(l.saleUnit, l.quantity, l.length), l.name);
    }
  }
  return [...needs.values()];
}

export type PlacedOrder = { id: string; number: number; publicToken: string; total: number; paymentId: string; provider: CheckoutInput["paymentProvider"] };

/**
 * Crea el pedido de forma atómica: re-precia, calcula despacho, descuenta stock
 * (falla si otro cliente compró lo último), registra el pago pendiente y vacía el carro.
 */
export async function placeOrder(input: CheckoutInput, ctx: { cartToken: string; customerId?: string | null }): Promise<PlacedOrder> {
  await releaseExpiredOrders();

  const provider = getProvider(input.paymentProvider);
  const setting = await db.paymentMethodSetting.findUnique({ where: { provider: input.paymentProvider } });
  if (!provider || !provider.isConfigured() || !setting?.enabled) throw new CheckoutError("El medio de pago elegido no está disponible.", "paymentProvider");

  const { cart, lines, variants } = await loadCartForCheckout(ctx.cartToken);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  let shipping: ShippingQuote | null = null;
  let shippingAddress: Prisma.InputJsonValue | undefined;
  if (input.fulfillment === "SHIPPING") {
    shipping = await quoteShipping(input.comuna!, subtotal);
    if (!shipping) throw new CheckoutError("No despachamos a esa comuna. Puedes elegir retiro en tienda.", "comuna");
    shippingAddress = {
      region: input.region!,
      comuna: input.comuna!,
      street: input.street!,
      number: input.number!,
      apartment: input.apartment ?? null,
      notes: input.addressNotes ?? null,
    };
  } else {
    const settings = await db.storeSettings.findUnique({ where: { id: 1 } });
    if (!settings?.pickupEnabled) throw new CheckoutError("El retiro en tienda no está disponible.", "fulfillment");
  }
  const shippingCostValue = shipping?.cost ?? 0;
  const total = subtotal + shippingCostValue;

  const kitItemsByVariant = new Map(
    variants.filter((v) => v.product.type === "KIT").map((v) => [v.id, v.product.kitItems.map((k) => ({ variantId: k.variantId, quantity: Number(k.quantity) }))]),
  );
  const needs = computeStockNeeds(lines, kitItemsByVariant);
  const expiresAt = new Date(Date.now() + provider.reservationMinutes * 60_000);

  return db.$transaction(async (tx) => {
    // 1. Descuento de stock condicional (atómico por fila)
    for (const need of needs) {
      const res = await tx.productVariant.updateMany({
        where: { id: need.variantId, stock: { gte: need.amount } },
        data: { stock: { decrement: need.amount } },
      });
      if (res.count === 0) throw new CheckoutError(`Ya no hay stock suficiente de "${need.label}". Revisa tu carro.`);
    }

    // 2. Pedido con fotos (snapshots) de precios y kits
    const order = await tx.order.create({
      data: {
        // Token aleatorio criptográfico: da acceso al pedido sin cuenta
        publicToken: randomBytes(18).toString("base64url"),
        customerId: ctx.customerId ?? null,
        email: input.email,
        name: input.name,
        phone: input.phone,
        rut: input.rut ?? null,
        fulfillment: input.fulfillment,
        shippingAddress,
        shippingZoneId: shipping?.zoneId ?? null,
        shippingZoneName: shipping?.zoneName ?? null,
        subtotal,
        shippingCost: shippingCostValue,
        total,
        paymentProvider: input.paymentProvider,
        customerNotes: input.customerNotes ?? null,
        expiresAt,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            name: l.name,
            variantName: l.variantName,
            sku: l.sku,
            saleUnit: l.saleUnit,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            length: l.length,
            lineTotal: l.lineTotal,
            kitSnapshot:
              l.type === "KIT"
                ? (variants
                    .find((v) => v.id === l.variantId)!
                    .product.kitItems.map((k) => ({ variantId: k.variantId, name: k.variant.product.name, variantName: k.variant.name, quantity: Number(k.quantity) })) as Prisma.InputJsonValue)
                : undefined,
          })),
        },
        events: { create: { to: "PENDING_PAYMENT", comment: "Pedido creado" } },
      },
    });
    const payment = await tx.payment.create({ data: { orderId: order.id, provider: input.paymentProvider, amount: total } });

    // 3. Más vendidos
    const soldByProduct = new Map<string, number>();
    for (const l of lines) soldByProduct.set(l.productId, (soldByProduct.get(l.productId) ?? 0) + l.quantity);
    for (const [productId, qty] of soldByProduct) await tx.product.update({ where: { id: productId }, data: { soldCount: { increment: qty } } });

    // 4. Guardar dirección (cliente con sesión)
    if (ctx.customerId && input.saveAddress && shippingAddress) {
      await tx.address.create({
        data: {
          customerId: ctx.customerId,
          region: input.region!,
          comuna: input.comuna!,
          street: input.street!,
          number: input.number!,
          apartment: input.apartment,
          notes: input.addressNotes,
        },
      });
    }

    // 5. Vaciar carro
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return { id: order.id, number: order.number, publicToken: order.publicToken, total, paymentId: payment.id, provider: input.paymentProvider };
  });
}

/** Devuelve al stock lo reservado por un pedido (al cancelar o expirar). */
export async function restockOrder(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    const kit = item.kitSnapshot as { variantId: string; quantity: number }[] | null;
    if (kit) {
      for (const c of kitStockRequired(kit, item.quantity)) {
        await tx.productVariant.updateMany({ where: { id: c.variantId }, data: { stock: { increment: c.amount } } });
      }
    } else if (item.variantId) {
      const amount = stockRequired(item.saleUnit, item.quantity, item.length == null ? null : Number(item.length));
      await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: amount } } });
    }
  }
}

/** Cancela pedidos impagos cuya reserva venció y libera su stock. */
export async function releaseExpiredOrders(now = new Date()): Promise<number> {
  const expired = await db.order.findMany({ where: { status: "PENDING_PAYMENT", expiresAt: { lt: now } }, select: { id: true } });
  let released = 0;
  for (const { id } of expired) {
    await db.$transaction(async (tx) => {
      // Cambio condicional: si otro proceso ya lo tomó, no se repone dos veces
      const res = await tx.order.updateMany({ where: { id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
      if (res.count === 0) return;
      await restockOrder(tx, id);
      await tx.payment.updateMany({ where: { orderId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.orderStatusEvent.create({ data: { orderId: id, from: "PENDING_PAYMENT", to: "CANCELLED", comment: "Reserva vencida sin pago" } });
      released++;
    });
  }
  return released;
}
