import "server-only";
import type { OrderStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { restockOrder } from "@/modules/checkout/service";
import { canTransition, restocksOn } from "./transitions";

export class OrderTransitionError extends Error {}

/**
 * Cambia el estado de un pedido de forma atómica: valida la transición, repone
 * stock si corresponde, actualiza pagos y registra el historial.
 */
export async function changeOrderStatus(input: { orderId: string; to: OrderStatus; adminUserId?: string | null; comment?: string | null }) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new OrderTransitionError("El pedido no existe.");
    if (order.status === input.to) return order;
    if (!canTransition(order.status, input.to)) throw new OrderTransitionError(`No se puede pasar de "${order.status}" a "${input.to}".`);

    // Cambio condicional: si otro proceso cambió el estado, no se aplica dos veces
    const res = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: input.to, ...(input.to !== "PENDING_PAYMENT" ? { expiresAt: null } : {}) },
    });
    if (res.count === 0) throw new OrderTransitionError("El pedido cambió mientras tanto. Recarga la página.");

    if (restocksOn(order.status, input.to)) await restockOrder(tx, order.id);
    if (input.to === "PAID") {
      await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "AUTHORIZED" } });
    }
    if (input.to === "CANCELLED") {
      await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    }
    if (input.to === "REFUNDED") {
      await tx.payment.updateMany({ where: { orderId: order.id, status: "AUTHORIZED" }, data: { status: "REFUNDED" } });
    }
    await tx.orderStatusEvent.create({
      data: { orderId: order.id, from: order.status, to: input.to, adminUserId: input.adminUserId ?? null, comment: input.comment ?? null },
    });
    return { ...order, status: input.to };
  });
}
