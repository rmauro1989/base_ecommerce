import type { OrderStatus } from "@/generated/prisma/enums";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  PREPARING: "En preparación",
  SHIPPED: "Despachado",
  READY_FOR_PICKUP: "Listo para retiro",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "accent" | "primary" | "success" | "danger" | "soft"> = {
  PENDING_PAYMENT: "accent",
  PAID: "success",
  PREPARING: "soft",
  SHIPPED: "primary",
  READY_FOR_PICKUP: "primary",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
};

export const BANK_LABELS: Record<string, string> = {
  banco: "Banco",
  tipoCuenta: "Tipo de cuenta",
  numeroCuenta: "N° de cuenta",
  titular: "Titular",
  rut: "RUT",
  email: "Correo",
};
