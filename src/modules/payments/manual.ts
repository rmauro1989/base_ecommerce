import type { PaymentProvider } from "./provider";

/** Transferencia bancaria: el pedido queda pendiente hasta que el admin confirme el pago. */
export const manualTransferProvider: PaymentProvider = {
  id: "MANUAL_TRANSFER",
  defaultLabel: "Transferencia bancaria",
  reservationMinutes: 48 * 60,
  isConfigured: () => true,
  mode: () => "production",
  async start() {
    return { type: "instructions" };
  },
};
