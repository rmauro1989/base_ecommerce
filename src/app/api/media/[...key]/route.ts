import { readLocalFile } from "@/modules/media/storage";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", avif: "image/avif", gif: "image/gif" };

/** Sirve imágenes guardadas en disco local (cuando no hay S3). */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join("/");
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return new Response("No encontrado", { status: 404 });
  const file = await readLocalFile(key);
  if (!file) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
