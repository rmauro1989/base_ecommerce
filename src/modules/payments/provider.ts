import type { PaymentProvider as PaymentProviderId } from "@/generated/prisma/enums";

export type { PaymentProviderId };

export type OrderForPayment = {
  id: string;
  number: number;
  publicToken: string;
  total: number;
  email: string;
  name: string;
};

/** Qué debe hacer la tienda después de crear el pedido. */
export type PaymentStart =
  | { type: "redirect"; url: string; externalId?: string }
  | { type: "form_post"; url: string; fields: Record<string, string>; externalId?: string }
  | { type: "instructions" };

export type PaymentReturnResult = { orderToken: string; status: "AUTHORIZED" | "FAILED" | "CANCELLED" | "PENDING"; message?: string };

/**
 * Contrato común para Webpay, Mercado Pago y transferencia manual.
 * Las credenciales se leen solo desde variables de entorno.
 */
export interface PaymentProvider {
  id: PaymentProviderId;
  /** Nombre por defecto (se puede cambiar en admin > Medios de pago) */
  defaultLabel: string;
  /** Minutos que se reserva el stock esperando el pago */
  reservationMinutes: number;
  /** ¿Tiene las variables de entorno necesarias? */
  isConfigured(): boolean;
  /** "Pruebas" | "Producción" (para mostrar en el admin) */
  mode(): "test" | "production";
  /** Inicia el pago de un pedido ya creado. */
  start(order: OrderForPayment, ctx: { baseUrl: string; paymentId: string }): Promise<PaymentStart>;
  /** Procesa el retorno del usuario desde la pasarela (si aplica). */
  handleReturn?(req: Request): Promise<PaymentReturnResult>;
  /** Procesa notificaciones servidor-a-servidor (si aplica). */
  handleWebhook?(req: Request): Promise<Response>;
}
