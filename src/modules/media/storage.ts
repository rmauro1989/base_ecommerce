import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Almacenamiento de imágenes.
 * - S3 (o compatible: R2, MinIO, Spaces) si S3_BUCKET está definido.
 * - Disco local en UPLOAD_DIR si no (en Railway: un volumen montado en /data).
 */
export interface Storage {
  kind: "s3" | "local";
  put(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}

const LOCAL_PREFIX = "/api/media/";

export function s3Configured() {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || (process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads") : "uploads"));
}

function createS3Storage(): Storage {
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION || "auto";
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  const publicBase = (process.env.S3_PUBLIC_URL || (endpoint ? `${endpoint}/${bucket}` : `https://${bucket}.s3.${region}.amazonaws.com`)).replace(/\/$/, "");
  return {
    kind: "s3",
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
      return { url: `${publicBase}/${key}` };
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

/** Evita path traversal: solo [a-z0-9/_.-] y sin "..". */
export function safeKey(key: string): string | null {
  if (!/^[a-zA-Z0-9/_.-]{1,200}$/.test(key) || key.includes("..") || key.startsWith("/")) return null;
  return key;
}

function createLocalStorage(): Storage {
  const dir = uploadDir();
  return {
    kind: "local",
    async put(key, body) {
      const file = path.join(dir, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
      return { url: `${LOCAL_PREFIX}${key}` };
    },
    async delete(key) {
      await rm(path.join(dir, key), { force: true });
    },
  };
}

export async function readLocalFile(key: string): Promise<Buffer | null> {
  const k = safeKey(key);
  if (!k) return null;
  try {
    return await readFile(path.join(uploadDir(), k));
  } catch {
    return null;
  }
}

let storage: Storage | null = null;
export function getStorage(): Storage {
  storage ??= s3Configured() ? createS3Storage() : createLocalStorage();
  return storage;
}
