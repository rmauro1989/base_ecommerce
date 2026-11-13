import { z } from "zod";
import { isValidComuna, isValidRut, formatRut } from "@/lib/chile";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const checkoutSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Correo inválido").max(150),
    name: z.string().trim().min(3, "Ingresa tu nombre completo").max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s-]{8,16}$/, "Teléfono inválido"),
    rut: optionalText(14).refine((v) => !v || isValidRut(v), "RUT inválido").transform((v) => (v ? formatRut(v) : undefined)),
    fulfillment: z.enum(["SHIPPING", "PICKUP"], { message: "Elige despacho o retiro" }),
    region: optionalText(80),
    comuna: optionalText(80),
    street: optionalText(120),
    number: optionalText(20),
    apartment: optionalText(40),
    addressNotes: optionalText(200),
    paymentProvider: z.enum(["WEBPAY", "MERCADOPAGO", "MANUAL_TRANSFER"], { message: "Elige un medio de pago" }),
    customerNotes: optionalText(500),
    saveAddress: z.coerce.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment !== "SHIPPING") return;
    if (!v.region) ctx.addIssue({ code: "custom", path: ["region"], message: "Elige la región" });
    if (!v.comuna) ctx.addIssue({ code: "custom", path: ["comuna"], message: "Elige la comuna" });
    else if (v.region && !isValidComuna(v.region, v.comuna)) ctx.addIssue({ code: "custom", path: ["comuna"], message: "La comuna no corresponde a la región" });
    if (!v.street) ctx.addIssue({ code: "custom", path: ["street"], message: "Ingresa la calle" });
    if (!v.number) ctx.addIssue({ code: "custom", path: ["number"], message: "Ingresa el número" });
  });

export type CheckoutInput = z.output<typeof checkoutSchema>;
