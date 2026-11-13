import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Imagen de producto cuadrada. SVG (placeholders) y URLs externas (S3/CDN, ya
 * optimizadas al subirlas) se sirven sin pasar por el optimizador de Next.
 */
export function ProductImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority,
  className,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-bg", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={src.endsWith(".svg") || /^https?:\/\//.test(src)} className="object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">Sin imagen</div>
      )}
    </div>
  );
}
