import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/store/product-image";
import type { ProductCardData } from "../queries";
import { Price } from "./price";

export function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const discount = product.compareAtPrice && product.compareAtPrice > product.price;
  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong"
    >
      <div className="relative">
        <ProductImage src={product.imageUrl} alt={product.imageAlt} priority={priority} className="transition-transform group-hover:scale-[1.02]" />
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {product.type === "KIT" ? <Badge tone="accent">Kit{product.kitSavingsPercent ? ` · ahorra ${product.kitSavingsPercent}%` : ""}</Badge> : null}
          {discount ? <Badge tone="accent">Oferta</Badge> : null}
          {!product.inStock ? <Badge tone="danger">Sin stock</Badge> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-border p-3">
        {product.brand ? <p className="text-xs font-medium tracking-wide text-muted uppercase">{product.brand}</p> : null}
        <h3 className="line-clamp-2 text-sm font-semibold group-hover:underline">{product.name}</h3>
        <Price
          className="mt-auto pt-1"
          amount={product.price}
          compareAt={product.compareAtPrice}
          saleUnit={product.saleUnit}
          packLabel={product.packLabel}
        />
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
