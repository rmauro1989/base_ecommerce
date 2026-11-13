import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getStorage } from "./storage";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export class UploadError extends Error {}

export type UploadKind = "product" | "logo" | "favicon" | "category";

const SIZES: Record<UploadKind, { max: number; format: "webp" | "png" }> = {
  product: { max: 1600, format: "webp" },
  category: { max: 1200, format: "webp" },
  logo: { max: 800, format: "png" },
  favicon: { max: 256, format: "png" },
};

/**
 * Valida, normaliza (rota según EXIF, redimensiona, convierte) y guarda una imagen.
 * Se rechazan SVG: pueden contener scripts.
 */
export async function saveImage(file: File, kind: UploadKind) {
  if (!ACCEPTED.includes(file.type)) throw new UploadError(`Formato no permitido (${file.type || "desconocido"}). Usa JPG, PNG o WebP.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("La imagen supera 8 MB.");

  const input = Buffer.from(await file.arrayBuffer());
  const { max, format } = SIZES[kind];
  let pipeline = sharp(input, { failOn: "error" }).rotate().resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });
  if (kind === "favicon") pipeline = pipeline.resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  let output: Buffer;
  try {
    output = format === "webp" ? await pipeline.webp({ quality: 82 }).toBuffer() : await pipeline.png().toBuffer();
  } catch {
    throw new UploadError("No pudimos leer la imagen. ¿Está dañada?");
  }
  const meta = await sharp(output).metadata();
  const now = new Date();
  const key = `${kind}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomBytes(8).toString("hex")}.${format}`;
  const contentType = format === "webp" ? "image/webp" : "image/png";
  const { url } = await getStorage().put(key, output, contentType);
  return db.mediaAsset.create({ data: { key, url, mimeType: contentType, size: output.length, width: meta.width ?? null, height: meta.height ?? null } });
}
