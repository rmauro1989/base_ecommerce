import "server-only";
import { db } from "@/lib/db";
import { manualTransferProvider } from "./manual";
import type { PaymentProvider, PaymentProviderId } from "./provider";

const providers: Partial<Record<PaymentProviderId, PaymentProvider>> = {
  MANUAL_TRANSFER: manualTransferProvider,
};

export function getProvider(id: PaymentProviderId): PaymentProvider | null {
  return providers[id] ?? null;
}

export function registerProvider(p: PaymentProvider) {
  providers[p.id] = p;
}

export type AvailablePaymentMethod = { id: PaymentProviderId; label: string; instructions: string | null; mode: "test" | "production" };

/** Medios activos en el admin Y con credenciales configuradas. */
export async function getAvailablePaymentMethods(): Promise<AvailablePaymentMethod[]> {
  const settings = await db.paymentMethodSetting.findMany({ where: { enabled: true }, orderBy: { position: "asc" } });
  return settings
    .map((s) => {
      const p = providers[s.provider];
      if (!p || !p.isConfigured()) return null;
      return { id: s.provider, label: s.displayName || p.defaultLabel, instructions: s.instructions, mode: p.mode() };
    })
    .filter((m): m is AvailablePaymentMethod => m !== null);
}
