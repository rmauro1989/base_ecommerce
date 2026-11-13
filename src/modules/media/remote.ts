import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { MAX_UPLOAD_BYTES, saveImage, UploadError } from "./upload";

/** IPs privadas, locales o reservadas (protección SSRF). */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("ff");
}

async function assertPublicHttps(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UploadError("URL inválida.");
  }
  if (url.protocol !== "https:") throw new UploadError("Solo se aceptan URLs https.");
  if (url.username || url.password) throw new UploadError("La URL no puede incluir credenciales.");
  const addrs = await lookup(url.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new UploadError(`No se pudo resolver ${url.hostname}.`);
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new UploadError("La URL apunta a una dirección no permitida.");
  return url;
}

/** Descarga una imagen pública y la guarda como cualquier subida. */
export async function importImageFromUrl(raw: string) {
  let url = await assertPublicHttps(raw);
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { accept: "image/*" } }).catch(() => null);
    if (!res) throw new UploadError("No se pudo descargar la imagen (tiempo agotado o servidor caído).");
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicHttps(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    break;
  }
  if (!res || !res.ok || !res.body) throw new UploadError(`La imagen respondió con error ${res?.status ?? ""}.`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (Number(res.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) throw new UploadError("La imagen supera 8 MB.");

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_UPLOAD_BYTES) {
      await reader.cancel();
      throw new UploadError("La imagen supera 8 MB.");
    }
    chunks.push(value);
  }
  const name = url.pathname.split("/").pop() || "imagen";
  return saveImage(new File(chunks as BlobPart[], name, { type }), "product");
}
