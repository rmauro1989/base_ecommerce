import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string };

/**
 * Envía un correo por SMTP. Sin SMTP configurado lo escribe en el log
 * (la compra nunca falla por un correo).
 */
export async function sendMail(mail: Mail): Promise<{ sent: boolean }> {
  const t = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost";
  if (!t) {
    console.info(`[email] (sin SMTP) Para: ${mail.to} · Asunto: ${mail.subject}\n${mail.text}`);
    return { sent: false };
  }
  try {
    await t.sendMail({ from, ...mail });
    return { sent: true };
  } catch (e) {
    console.error("[email] Error al enviar:", e);
    return { sent: false };
  }
}
