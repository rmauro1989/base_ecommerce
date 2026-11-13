import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE, type CatalogParams } from "./filters";
import { kitAvailableStock, kitSavings, type SaleUnit } from "./pricing";

/** Tag único del catálogo: se invalida al editar productos, categorías o al vender. */
export const CATALOG_TAG = "catalog";

const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? null : Number(d));

// ─────────────────────────── Categorías ───────────────────────────

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  path: string[];
  productCount: number;
  children: CategoryNode[];
};

export async function getCategoryTree() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const cats = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      imageAsset: { select: { url: true } },
      _count: { select: { products: { where: { status: "PUBLISHED" } } } },
    },
  });
  const nodes = new Map<string, CategoryNode>();
  for (const c of cats) {
    nodes.set(c.id, {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId: c.parentId,
      imageUrl: c.imageAsset?.url ?? null,
      path: [],
      productCount: c._count.products,
      children: [],
    });
  }
  const roots: CategoryNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const setPaths = (list: CategoryNode[], prefix: string[]) => {
    for (const n of list) {
      n.path = [...prefix, n.slug];
      setPaths(n.children, n.path);
    }
  };
  setPaths(roots, []);
  // Conteo acumulado (incluye subcategorías)
  const total = (n: CategoryNode): number => {
    n.productCount += n.children.reduce((s, c) => s + total(c), 0);
    return n.productCount;
  };
  roots.forEach(total);
  return roots;
}

export function flattenTree(tree: CategoryNode[]): CategoryNode[] {
  return tree.flatMap((n) => [n, ...flattenTree(n.children)]);
}

export function categoryHref(c: Pick<CategoryNode, "path">) {
  return `/categoria/${c.path.join("/")}`;
}

export async function findCategoryBySlug(slug: string) {
  const all = flattenTree(await getCategoryTree());
  const cat = all.find((c) => c.slug === slug);
  if (!cat) return null;
  const ancestors = cat.path.slice(0, -1).map((s) => all.find((c) => c.slug === s)!);
  return { category: cat, ancestors, descendantIds: flattenTree([cat]).map((c) => c.id) };
}

// ─────────────────────────── Tarjetas de producto ───────────────────────────

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  type: "SIMPLE" | "KIT";
  saleUnit: SaleUnit;
  price: number;
  compareAtPrice: number | null;
  packLabel: string | null;
  imageUrl: string | null;
  imageAlt: string;
  inStock: boolean;
  variantCount: number;
  kitSavingsPercent: number | null;
};

const cardInclude = {
  images: { orderBy: { position: "asc" }, take: 1, include: { asset: { select: { url: true } } } },
  variants: { where: { active: true }, select: { stock: true, priceOverride: true } },
  kitItems: {
    select: {
      quantity: true,
      variant: { select: { stock: true, priceOverride: true, product: { select: { price: true, saleUnit: true } } } },
    },
  },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function toCard(p: CardRow): ProductCardData {
  let inStock: boolean;
  let kitSavingsPercent: number | null = null;
  if (p.type === "KIT") {
    const items = p.kitItems.map((k) => ({
      quantity: Number(k.quantity),
      stock: Number(k.variant.stock),
      price: k.variant.priceOverride ?? k.variant.product.price,
      saleUnit: k.variant.product.saleUnit,
    }));
    inStock = kitAvailableStock(items) > 0;
    kitSavingsPercent = kitSavings(p.price, items).percent || null;
  } else {
    inStock = p.variants.some((v) => Number(v.stock) > 0);
  }
  const prices = p.variants.map((v) => v.priceOverride ?? p.price);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    type: p.type,
    saleUnit: p.saleUnit,
    price: prices.length && p.type !== "KIT" ? Math.min(...prices) : p.price,
    compareAtPrice: p.compareAtPrice,
    packLabel: p.packLabel,
    imageUrl: p.images[0]?.asset.url ?? null,
    imageAlt: p.images[0]?.alt ?? p.name,
    inStock,
    variantCount: p.variants.length,
    kitSavingsPercent,
  };
}

// ─────────────────────────── Listado ───────────────────────────

export type ListInput = CatalogParams & { categoryIds?: string[]; type?: "KIT" };

async function attributeWhere(attrs: CatalogParams["attrs"]): Promise<Prisma.ProductWhereInput[]> {
  const keys = Object.keys(attrs);
  if (!keys.length) return [];
  const defs = await db.attributeDefinition.findMany({ where: { key: { in: keys } } });
  return defs.map((def) => {
    const values = attrs[def.key];
    const or: Prisma.ProductAttributeValueWhereInput[] =
      def.type === "NUMBER"
        ? values.map((v) => Number(v.replace(",", "."))).filter(Number.isFinite).map((n) => ({ valueNumber: n }))
        : def.type === "BOOLEAN"
          ? values.map((v) => ({ valueBool: v === "si" || v === "true" }))
          : values.map((v) => ({ valueText: v }));
    return { attributes: { some: { attributeId: def.id, OR: or.length ? or : [{ attributeId: "__none__" }] } } };
  });
}

function searchWhere(q: string): Prisma.ProductWhereInput | undefined {
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
  if (!terms.length) return undefined;
  return {
    AND: terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: "insensitive" } },
        { brand: { contains: t, mode: "insensitive" } },
        { shortDescription: { contains: t, mode: "insensitive" } },
        { category: { name: { contains: t, mode: "insensitive" } } },
        { variants: { some: { sku: { contains: t, mode: "insensitive" } } } },
      ],
    })),
  };
}

function baseWhere(input: Pick<ListInput, "q" | "categoryIds" | "type">): Prisma.ProductWhereInput {
  return {
    status: "PUBLISHED",
    ...(input.categoryIds ? { categoryId: { in: input.categoryIds } } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(searchWhere(input.q) ?? {}),
  };
}

const ORDER: Record<CatalogParams["sort"], Prisma.ProductOrderByWithRelationInput[]> = {
  relevancia: [{ soldCount: "desc" }, { name: "asc" }],
  "precio-asc": [{ price: "asc" }],
  "precio-desc": [{ price: "desc" }],
  nombre: [{ name: "asc" }],
  nuevos: [{ publishedAt: "desc" }],
};

export async function listProducts(input: ListInput) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const where: Prisma.ProductWhereInput = { AND: [baseWhere(input), ...(await attributeWhere(input.attrs))] };
  const [total, rows] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: ORDER[input.sort],
      skip: (input.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: cardInclude,
    }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), items: rows.map(toCard) };
}

// ─────────────────────────── Facetas (filtros) ───────────────────────────

export type Facet = {
  key: string;
  label: string;
  unit: string | null;
  values: { value: string; label: string; count: number }[];
};

/** Atributos filtrables de la categoría (propios + heredados) con sus valores y conteos. */
export async function getFacets(input: Pick<ListInput, "q" | "categoryIds"> & { categoryChain?: string[] }) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const attrFilter: Prisma.AttributeDefinitionWhereInput = input.categoryChain?.length
    ? { filterable: true, categories: { some: { categoryId: { in: input.categoryChain } } } }
    : { filterable: true };
  const defs = await db.attributeDefinition.findMany({ where: attrFilter, orderBy: { position: "asc" } });
  if (!defs.length) return [];

  const groups = await db.productAttributeValue.groupBy({
    by: ["attributeId", "valueText", "valueNumber", "valueBool"],
    where: { attributeId: { in: defs.map((d) => d.id) }, product: baseWhere(input) },
    _count: { _all: true },
  });

  const facets: Facet[] = [];
  for (const def of defs) {
    const values = groups
      .filter((g) => g.attributeId === def.id)
      .map((g) => {
        if (def.type === "NUMBER" && g.valueNumber != null) {
          const n = Number(g.valueNumber);
          return { sort: n, value: String(n), label: `${n.toLocaleString("es-CL")}${def.unit ? ` ${def.unit}` : ""}`, count: g._count._all };
        }
        if (def.type === "BOOLEAN" && g.valueBool != null) {
          return { sort: g.valueBool ? 0 : 1, value: g.valueBool ? "si" : "no", label: g.valueBool ? "Sí" : "No", count: g._count._all };
        }
        if (g.valueText) {
          const idx = def.options.indexOf(g.valueText);
          return { sort: idx >= 0 ? idx : 999, value: g.valueText, label: g.valueText, count: g._count._all };
        }
        return null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => (a.sort === b.sort ? a.label.localeCompare(b.label) : a.sort < b.sort ? -1 : 1));
    if (values.length > 0) facets.push({ key: def.key, label: def.label, unit: def.unit, values: values.map(({ value, label, count }) => ({ value, label, count })) });
  }
  return facets;
}

// ─────────────────────────── Secciones del inicio ───────────────────────────

export async function getBestsellers(limit = 8) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const rows = await db.product.findMany({
    where: { status: "PUBLISHED", type: "SIMPLE" },
    orderBy: [{ soldCount: "desc" }, { name: "asc" }],
    take: limit,
    include: cardInclude,
  });
  return rows.map(toCard);
}

export async function getFeatured(limit = 8) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const rows = await db.product.findMany({
    where: { status: "PUBLISHED", featured: true },
    orderBy: [{ soldCount: "desc" }],
    take: limit,
    include: cardInclude,
  });
  return rows.map(toCard);
}

export async function getKits(limit = 12) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const rows = await db.product.findMany({
    where: { status: "PUBLISHED", type: "KIT" },
    orderBy: [{ soldCount: "desc" }],
    take: limit,
    include: { ...cardInclude, _count: { select: { kitItems: true } } },
  });
  return rows.map((r) => ({ ...toCard(r), shortDescription: r.shortDescription, componentCount: r._count.kitItems }));
}

// ─────────────────────────── Ficha de producto ───────────────────────────

export async function getProductBySlug(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const p = await db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { position: "asc" }, include: { asset: { select: { url: true, width: true, height: true } } } },
      variants: { where: { active: true }, orderBy: { position: "asc" } },
      attributes: { include: { attribute: true }, orderBy: { attribute: { position: "asc" } } },
      kitItems: {
        orderBy: { position: "asc" },
        include: {
          variant: {
            include: {
              product: {
                select: { slug: true, name: true, saleUnit: true, price: true, status: true, images: { take: 1, orderBy: { position: "asc" }, include: { asset: { select: { url: true } } } } },
              },
            },
          },
        },
      },
      relatedFrom: {
        orderBy: { position: "asc" },
        where: { to: { status: "PUBLISHED" } },
        include: { to: { include: cardInclude } },
      },
    },
  });
  if (!p || p.status !== "PUBLISHED") return null;

  const kitComponents = p.kitItems.map((k) => ({
    variantId: k.variantId,
    productSlug: k.variant.product.slug,
    productName: k.variant.product.name,
    variantName: k.variant.name === "Por defecto" ? null : k.variant.name,
    sku: k.variant.sku,
    saleUnit: k.variant.product.saleUnit,
    quantity: Number(k.quantity),
    stock: Number(k.variant.stock),
    price: k.variant.priceOverride ?? k.variant.product.price,
    imageUrl: k.variant.product.images[0]?.asset.url ?? null,
  }));

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    type: p.type,
    shortDescription: p.shortDescription,
    description: p.description,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    saleUnit: p.saleUnit,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    lengthPresets: p.lengthPresets.map(Number),
    allowCustomLength: p.allowCustomLength,
    minLength: num(p.minLength),
    maxLength: num(p.maxLength),
    lengthStep: num(p.lengthStep),
    packContent: num(p.packContent),
    packLabel: p.packLabel,
    categoryId: p.categoryId,
    categorySlug: p.category?.slug ?? null,
    images: p.images.map((i) => ({ url: i.asset.url, alt: i.alt ?? p.name, width: i.asset.width, height: i.asset.height })),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      options: (v.options ?? {}) as Record<string, string>,
      price: v.priceOverride ?? p.price,
      stock: p.type === "KIT" ? kitAvailableStock(kitComponents) : Number(v.stock),
      isDefault: v.isDefault,
    })),
    specs: p.attributes
      .map((a) => {
        const d = a.attribute;
        let value: string | null = null;
        if (d.type === "NUMBER" && a.valueNumber != null) value = `${Number(a.valueNumber).toLocaleString("es-CL")}${d.unit ? ` ${d.unit}` : ""}`;
        else if (d.type === "BOOLEAN" && a.valueBool != null) value = a.valueBool ? "Sí" : "No";
        else if (a.valueText) value = `${a.valueText}${d.unit && d.type !== "SELECT" ? ` ${d.unit}` : ""}`;
        return value ? { key: d.key, label: d.label, value } : null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null),
    kitComponents,
    kitSavings: p.type === "KIT" ? kitSavings(p.price, kitComponents) : null,
    related: p.relatedFrom.map((r) => toCard(r.to)),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

/** Para sitemap.xml */
export async function getSitemapEntries() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    getCategoryTree(),
  ]);
  return {
    products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
    categories: flattenTree(categories).map((c) => ({ href: categoryHref(c) })),
  };
}
