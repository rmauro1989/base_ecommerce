import Image from "next/image";
import { cn } from "@/lib/cn";

/** Imagen de producto cuadrada. Los SVG (placeholders) se sirven sin optimizar. */
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
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={src.endsWith(".svg")} className="object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted">Sin imagen</div>
      )}
    </div>
  );
}
