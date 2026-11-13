import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { kitAvailableStock, linePrice, piecePrice, stockRequired, unitPrice, type SaleUnit } from "@/modules/catalog/pricing";

export const CART_COOKIE = "cart_token";
const CART_MAX_AGE = 60 * 60 * 24 * 30;

export async function readCartToken(): Promise<string | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  return token && /^[a-f0-9]{48}$/.test(token) ? token : null;
}

/** Obtiene o crea el carrito (solo dentro de server actions / route handlers). */
export async function ensureCart() {
  const token = await readCartToken();
  if (token) {
    const cart = await db.cart.findUnique({ where: { token } });
    if (cart) return cart;
  }
  const newToken = randomBytes(24).toString("hex");
  const cart = await db.cart.create({ data: { token: newToken } });
  (await cookies()).set(CART_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE,
  });
  return cart;
}

/** Variante con lo necesario para precio y stock (incluye componentes si es kit). */
export const variantForCartInclude = {
  product: {
    include: {
      images: { take: 1, orderBy: { position: "asc" }, include: { asset: { select: { url: true } } } },
      kitItems: { include: { variant: { include: { product: { select: { name: true, saleUnit: true, price: true } } } } } },
    },
  },
} satisfies Prisma.ProductVariantInclude;

export type VariantForCart = Prisma.ProductVariantGetPayload<{ include: typeof variantForCartInclude }>;

/** Stock disponible de una variante en su unidad de venta (para kits: kits armables). */
export function availableStock(v: VariantForCart): number {
  if (v.product.type === "KIT") {
    return kitAvailableStock(v.product.kitItems.map((k) => ({ quantity: Number(k.quantity), stock: Number(k.variant.stock) })));
  }
  return Number(v.stock);
}

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  imageUrl: string | null;
  type: "SIMPLE" | "KIT";
  saleUnit: SaleUnit;
  packLabel: string | null;
  /** Precio por unidad de venta (por metro si es METER) */
  unitPrice: number;
  /** Precio de una pieza (por metro × largo) */
  piecePrice: number;
  quantity: number;
  length: number | null;
  lineTotal: number;
  /** Mensaje si la línea ya no se puede comprar tal cual */
  problem: string | null;
};

export type CartView = { id: string | null; lines: CartLine[]; subtotal: number; itemCount: number; hasProblems: boolean };

const EMPTY: CartView = { id: null, lines: [], subtotal: 0, itemCount: 0, hasProblems: false };

/** Construye las líneas recalculando precios y stock desde la base. */
export function buildCartLines(items: { id: string; variantId: string; quantity: number; length: number | null }[], variants: VariantForCart[]): CartLine[] {
  const byId = new Map(variants.map((v) => [v.id, v]));
  // Stock consumido acumulado por variante (varias líneas pueden usar la misma)
  const used = new Map<string, number>();
  return items.map((item) => {
    const v = byId.get(item.variantId);
    if (!v) {
      return {
        id: item.id, variantId: item.variantId, productId: "", productSlug: "", name: "Producto no disponible", variantName: null, sku: null, imageUrl: null,
        type: "SIMPLE", saleUnit: "UNIT", packLabel: null, unitPrice: 0, piecePrice: 0, quantity: item.quantity, length: item.length, lineTotal: 0,
        problem: "Este producto ya no está disponible. Quítalo para continuar.",
      };
    }
    const p = v.product;
    const price = unitPrice(p.price, v.priceOverride);
    const need = stockRequired(p.saleUnit, item.quantity, item.length);
    const already = used.get(v.id) ?? 0;
    used.set(v.id, already + need);
    const stock = availableStock(v);
    let problem: string | null = null;
    if (p.status !== "PUBLISHED" || !v.active) problem = "Este producto ya no está disponible. Quítalo para continuar.";
    else if (already + need > stock + 1e-9) {
      problem = stock <= 0 ? "Sin stock." : `Solo quedan ${stock.toLocaleString("es-CL")}${p.saleUnit === "METER" ? " m" : ""} disponibles.`;
    }
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      productSlug: p.slug,
      name: p.name,
      variantName: v.name === "Por defecto" ? null : v.name,
      sku: v.sku,
      imageUrl: p.images[0]?.asset.url ?? null,
      type: p.type,
      saleUnit: p.saleUnit,
      packLabel: p.packLabel,
      unitPrice: price,
      piecePrice: p.saleUnit === "METER" && item.length ? piecePrice("METER", price, item.length) : price,
      quantity: item.quantity,
      length: item.length,
      lineTotal: p.saleUnit === "METER" && !item.length ? 0 : linePrice(p.saleUnit, price, item.quantity, item.length),
      problem,
    };
  });
}

export async function getCart(): Promise<CartView> {
  const token = await readCartToken();
  if (!token) return EMPTY;
  const cart = await db.cart.findUnique({ where: { token }, include: { items: { orderBy: { createdAt: "asc" } } } });
  if (!cart) return EMPTY;
  const variants = await db.productVariant.findMany({
    where: { id: { in: cart.items.map((i) => i.variantId) } },
    include: variantForCartInclude,
  });
  const lines = buildCartLines(
    cart.items.map((i) => ({ id: i.id, variantId: i.variantId, quantity: i.quantity, length: i.length == null ? null : Number(i.length) })),
    variants,
  );
  return {
    id: cart.id,
    lines,
    subtotal: lines.reduce((s, l) => s + l.lineTotal, 0),
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    hasProblems: lines.some((l) => l.problem),
  };
}

export async function getCartCount(): Promise<number> {
  const token = await readCartToken();
  if (!token) return 0;
  const agg = await db.cartItem.aggregate({ where: { cart: { token } }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}
