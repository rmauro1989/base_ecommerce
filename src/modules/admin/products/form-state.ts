/** Estado del formulario de producto (compartido entre servidor y cliente). */
import type { ImageItem } from "./components/image-manager";

type SaleUnit = "UNIT" | "METER" | "PACK";

export type ProductFormState = {
  name: string;
  slug: string;
  brand: string;
  shortDescription: string;
  description: string;
  type: "SIMPLE" | "KIT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  categoryId: string;
  saleUnit: SaleUnit;
  price: number | null;
  compareAtPrice: number | null;
  lengthPresets: number[];
  allowCustomLength: boolean;
  minLength: number | null;
  maxLength: number | null;
  lengthStep: number | null;
  packContent: number | null;
  packLabel: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  images: ImageItem[];
  variants: { id?: string; name: string; sku: string; priceOverride: number | null; stock: number; active: boolean }[];
  attributes: Record<string, string>;
  related: { id: string; name: string }[];
  kitItems: { variantId: string; quantity: number; label: string; saleUnit: SaleUnit }[];
};

export const emptyProduct = (type: "SIMPLE" | "KIT" = "SIMPLE"): ProductFormState => ({
  name: "",
  slug: "",
  brand: "",
  shortDescription: "",
  description: "",
  type,
  status: "DRAFT",
  categoryId: "",
  saleUnit: "UNIT",
  price: null,
  compareAtPrice: null,
  lengthPresets: [],
  allowCustomLength: false,
  minLength: null,
  maxLength: null,
  lengthStep: null,
  packContent: null,
  packLabel: "",
  featured: false,
  seoTitle: "",
  seoDescription: "",
  images: [],
  variants: [{ name: "Por defecto", sku: "", priceOverride: null, stock: 0, active: true }],
  attributes: {},
  related: [],
  kitItems: [],
});

