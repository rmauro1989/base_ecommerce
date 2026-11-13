import type { OrderStatus } from "@/generated/prisma/enums";

/** Transiciones permitidas entre estados de pedido. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PREPARING", "SHIPPED", "READY_FOR_PICKUP", "CANCELLED", "REFUNDED"],
  PREPARING: ["SHIPPED", "READY_FOR_PICKUP", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  READY_FOR_PICKUP: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** ¿Se repone stock al pasar de `from` a `to`? (solo si la mercadería no salió) */
export function restocksOn(from: OrderStatus, to: OrderStatus) {
  const notShipped: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "PREPARING", "READY_FOR_PICKUP"];
  return (to === "CANCELLED" || to === "REFUNDED") && notShipped.includes(from);
}
