"use client";

import { useState } from "react";
import { ProductImage } from "@/components/store/product-image";
import { cn } from "@/lib/cn";

export function Gallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? null;
  return (
    <div className="flex flex-col gap-3">
      <ProductImage src={current?.url ?? null} alt={current?.alt ?? name} priority sizes="(min-width: 1024px) 50vw, 100vw" className="rounded-lg border border-border" />
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.url + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagen ${i + 1}`}
              aria-current={i === active}
              className={cn("w-20 shrink-0 overflow-hidden rounded-md border-2", i === active ? "border-primary" : "border-transparent")}
            >
              <ProductImage src={img.url} alt="" sizes="80px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
