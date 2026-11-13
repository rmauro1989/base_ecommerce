/**
 * Datos de ejemplo para una tienda nueva. Edítalos libremente: el seed solo corre
 * cuando la base está vacía (no hay StoreSettings).
 */
import type { AttributeType, SaleUnit } from "../../src/generated/prisma/enums";

export type SeedAttribute = {
  key: string;
  label: string;
  type: AttributeType;
  unit?: string;
  options?: string[];
  filterable?: boolean;
};

export const attributes: SeedAttribute[] = [
  { key: "seccion_mm2", label: "Sección", type: "NUMBER", unit: "mm²" },
  { key: "amperaje", label: "Amperaje", type: "NUMBER", unit: "A" },
  { key: "voltaje", label: "Voltaje", type: "NUMBER", unit: "V" },
  { key: "ip", label: "Grado IP", type: "SELECT", options: ["IP20", "IP44", "IP54", "IP55", "IP65", "IP67"] },
  { key: "material", label: "Material conductor", type: "SELECT", options: ["Cobre", "Aluminio"] },
  { key: "conductores", label: "N° de conductores", type: "NUMBER" },
  { key: "polos", label: "Polos", type: "NUMBER" },
  { key: "curva", label: "Curva de disparo", type: "SELECT", options: ["B", "C", "D"] },
  { key: "capacidad_ruptura", label: "Capacidad de ruptura", type: "NUMBER", unit: "kA" },
  { key: "sensibilidad", label: "Sensibilidad", type: "SELECT", options: ["30 mA", "300 mA"] },
  { key: "modulos", label: "Módulos", type: "NUMBER" },
  { key: "diametro_mm", label: "Diámetro", type: "NUMBER", unit: "mm" },
  { key: "certificacion_sec", label: "Certificación SEC", type: "BOOLEAN", filterable: false },
];

export type SeedCategory = {
  slug: string;
  name: string;
  description?: string;
  parent?: string;
  /** [key, required] */
  attributes?: [string, boolean][];
};

export const categories: SeedCategory[] = [
  { slug: "cables", name: "Cables y conductores", description: "Cables para instalaciones domiciliarias e industriales.", attributes: [["seccion_mm2", true], ["voltaje", false], ["material", false]] },
  { slug: "cable-unipolar", name: "Cable unipolar", parent: "cables" },
  { slug: "cable-multiconductor", name: "Cable multiconductor", parent: "cables", attributes: [["conductores", true]] },
  { slug: "enchufes", name: "Enchufes", description: "Enchufes interiores y de exterior.", attributes: [["amperaje", true], ["voltaje", false], ["ip", false], ["certificacion_sec", false]] },
  { slug: "interruptores", name: "Interruptores", description: "Interruptores simples, dobles y conmutadores.", attributes: [["amperaje", true], ["voltaje", false], ["modulos", false], ["ip", false]] },
  { slug: "protecciones", name: "Protecciones", description: "Disyuntores y diferenciales para tu tablero.", attributes: [["amperaje", true], ["polos", true]] },
  { slug: "disyuntores", name: "Disyuntores (automáticos)", parent: "protecciones", attributes: [["curva", true], ["capacidad_ruptura", false]] },
  { slug: "diferenciales", name: "Diferenciales", parent: "protecciones", attributes: [["sensibilidad", true]] },
  { slug: "canalizacion", name: "Canalización", description: "Tubos, cajas y accesorios.", attributes: [["diametro_mm", true], ["ip", false]] },
];

type AttrValue = string | number | boolean;

export type SeedProduct = {
  slug: string;
  name: string;
  brand?: string;
  category: string;
  saleUnit: SaleUnit;
  price: number;
  compareAtPrice?: number;
  shortDescription: string;
  description: string;
  lengthPresets?: number[];
  allowCustomLength?: boolean;
  minLength?: number;
  maxLength?: number;
  lengthStep?: number;
  packContent?: number;
  packLabel?: string;
  featured?: boolean;
  soldCount?: number;
  attributes: Record<string, AttrValue>;
  /** Si no hay variantes, se crea una "Por defecto" */
  variants?: { sku: string; name: string; options?: Record<string, string>; stock: number }[];
  sku?: string;
  stock?: number;
  /** slugs de "Se conecta con" */
  connectsWith?: string[];
};

const colores = ["Rojo", "Negro", "Azul", "Blanco", "Verde/amarillo"] as const;
const skuColor: Record<(typeof colores)[number], string> = { Rojo: "RJ", Negro: "NG", Azul: "AZ", Blanco: "BL", "Verde/amarillo": "VA" };
const cableVariants = (base: string, stock: number) =>
  colores.map((c) => ({ sku: `${base}-${skuColor[c]}`, name: c, options: { color: c }, stock }));

export const products: SeedProduct[] = [
  {
    slug: "cable-thhn-2-5-mm2",
    name: "Cable THHN 2,5 mm²",
    brand: "Conducta",
    category: "cable-unipolar",
    saleUnit: "METER",
    price: 690,
    shortDescription: "Conductor de cobre para circuitos de enchufes. Se vende por metro.",
    description: "Cable unipolar de cobre electrolítico, aislación PVC y cubierta de nylon. Uso típico: circuitos de enchufes en instalaciones domiciliarias (hasta 16 A). Elige un largo predefinido o pide la medida exacta.",
    lengthPresets: [5, 10, 25, 50, 100],
    allowCustomLength: true,
    minLength: 1,
    maxLength: 100,
    lengthStep: 0.5,
    soldCount: 320,
    featured: true,
    attributes: { seccion_mm2: 2.5, voltaje: 600, material: "Cobre" },
    variants: cableVariants("THHN25", 800),
    connectsWith: ["enchufe-doble-10a", "caja-derivacion-ip55"],
  },
  {
    slug: "cable-thhn-1-5-mm2",
    name: "Cable THHN 1,5 mm²",
    brand: "Conducta",
    category: "cable-unipolar",
    saleUnit: "METER",
    price: 490,
    shortDescription: "Conductor de cobre para circuitos de iluminación. Se vende por metro.",
    description: "Cable unipolar de cobre para circuitos de iluminación (hasta 10 A). Aislación PVC + nylon, 600 V.",
    lengthPresets: [5, 10, 25, 50, 100],
    allowCustomLength: true,
    minLength: 1,
    maxLength: 100,
    lengthStep: 0.5,
    soldCount: 280,
    attributes: { seccion_mm2: 1.5, voltaje: 600, material: "Cobre" },
    variants: cableVariants("THHN15", 800),
    connectsWith: ["interruptor-simple-9-12"],
  },
  {
    slug: "cable-thhn-4-mm2-rollo-100m",
    name: "Cable THHN 4 mm² · Rollo 100 m",
    brand: "Conducta",
    category: "cable-unipolar",
    saleUnit: "PACK",
    price: 98990,
    compareAtPrice: 109990,
    packContent: 100,
    packLabel: "Rollo 100 m",
    shortDescription: "Rollo cerrado de 100 m para alimentadores y circuitos de alto consumo.",
    description: "Conductor de cobre 4 mm² en rollo de 100 metros. Ideal para alimentadores, cocinas eléctricas y termos.",
    soldCount: 45,
    attributes: { seccion_mm2: 4, voltaje: 600, material: "Cobre" },
    sku: "THHN40-R100",
    stock: 25,
  },
  {
    slug: "cable-superflex-3x1-5",
    name: "Cable superflex 3×1,5 mm²",
    brand: "Conducta",
    category: "cable-multiconductor",
    saleUnit: "METER",
    price: 1290,
    shortDescription: "Cable flexible de 3 conductores para extensiones y artefactos.",
    description: "Cordón multiconductor flexible con chaqueta de PVC. 3 conductores de 1,5 mm² (fase, neutro y tierra).",
    lengthPresets: [3, 5, 10, 20],
    allowCustomLength: true,
    minLength: 1,
    maxLength: 50,
    lengthStep: 1,
    soldCount: 150,
    attributes: { seccion_mm2: 1.5, conductores: 3, voltaje: 500, material: "Cobre" },
    variants: [
      { sku: "SFX315-BL", name: "Blanco", options: { color: "Blanco" }, stock: 300 },
      { sku: "SFX315-NG", name: "Negro", options: { color: "Negro" }, stock: 300 },
    ],
    connectsWith: ["enchufe-exterior-16a-ip44"],
  },
  {
    slug: "enchufe-doble-10a",
    name: "Enchufe doble 10 A con tierra",
    brand: "Volta",
    category: "enchufes",
    saleUnit: "UNIT",
    price: 2490,
    shortDescription: "Enchufe doble de embutir, 3 polos con tierra.",
    description: "Módulo de enchufe doble 10 A / 250 V, norma chilena, con tapa incluida. Certificado SEC.",
    soldCount: 410,
    featured: true,
    attributes: { amperaje: 10, voltaje: 250, ip: "IP20", certificacion_sec: true },
    variants: [
      { sku: "ENC10D-BL", name: "Blanco", options: { color: "Blanco" }, stock: 120 },
      { sku: "ENC10D-GR", name: "Grafito", options: { color: "Grafito" }, stock: 60 },
    ],
    connectsWith: ["cable-thhn-2-5-mm2", "caja-derivacion-ip55"],
  },
  {
    slug: "enchufe-exterior-16a-ip44",
    name: "Enchufe exterior 16 A IP44",
    brand: "Volta",
    category: "enchufes",
    saleUnit: "UNIT",
    price: 6990,
    shortDescription: "Enchufe sobrepuesto con tapa para patios y terrazas.",
    description: "Enchufe sobrepuesto 16 A con tapa abatible y grado de protección IP44 contra salpicaduras.",
    soldCount: 90,
    attributes: { amperaje: 16, voltaje: 250, ip: "IP44", certificacion_sec: true },
    sku: "ENC16-IP44",
    stock: 40,
    connectsWith: ["cable-superflex-3x1-5", "diferencial-2p-25a-30ma"],
  },
  {
    slug: "interruptor-simple-9-12",
    name: "Interruptor simple 9/12",
    brand: "Volta",
    category: "interruptores",
    saleUnit: "UNIT",
    price: 1990,
    shortDescription: "Interruptor de un efecto para iluminación.",
    description: "Interruptor 9/12 de embutir, 10 A / 250 V, 1 módulo. Incluye placa.",
    soldCount: 260,
    attributes: { amperaje: 10, voltaje: 250, modulos: 1, ip: "IP20" },
    variants: [
      { sku: "INT912-BL", name: "Blanco", options: { color: "Blanco" }, stock: 150 },
      { sku: "INT912-GR", name: "Grafito", options: { color: "Grafito" }, stock: 80 },
    ],
    connectsWith: ["cable-thhn-1-5-mm2", "caja-derivacion-ip55"],
  },
  {
    slug: "disyuntor-1p-16a-curva-c",
    name: "Disyuntor 1P 16 A curva C",
    brand: "Protekta",
    category: "disyuntores",
    saleUnit: "UNIT",
    price: 4990,
    shortDescription: "Automático para circuitos de enchufes, 6 kA.",
    description: "Interruptor termomagnético 1 polo, 16 A, curva C, capacidad de ruptura 6 kA. Montaje en riel DIN.",
    soldCount: 230,
    featured: true,
    attributes: { amperaje: 16, polos: 1, curva: "C", capacidad_ruptura: 6 },
    sku: "DIS1P16C",
    stock: 70,
    connectsWith: ["diferencial-2p-25a-30ma", "cable-thhn-2-5-mm2"],
  },
  {
    slug: "diferencial-2p-25a-30ma",
    name: "Diferencial 2P 25 A 30 mA",
    brand: "Protekta",
    category: "diferenciales",
    saleUnit: "UNIT",
    price: 24990,
    shortDescription: "Protege a las personas ante fugas de corriente.",
    description: "Interruptor diferencial 2 polos, 25 A, sensibilidad 30 mA, tipo AC. Obligatorio en circuitos de enchufes.",
    soldCount: 120,
    attributes: { amperaje: 25, polos: 2, sensibilidad: "30 mA" },
    sku: "DIF2P25-30",
    stock: 30,
    connectsWith: ["disyuntor-1p-16a-curva-c"],
  },
  {
    slug: "caja-derivacion-ip55",
    name: "Caja de derivación 100×100 IP55",
    brand: "Volta",
    category: "canalizacion",
    saleUnit: "UNIT",
    price: 1490,
    shortDescription: "Caja estanca con conos de entrada para uniones de cables.",
    description: "Caja de derivación sobrepuesta de 100×100×50 mm con 7 conos de entrada. Grado IP55.",
    soldCount: 180,
    attributes: { diametro_mm: 100, ip: "IP55" },
    sku: "CAJ100-IP55",
    stock: 200,
    connectsWith: ["cable-thhn-2-5-mm2"],
  },
];

export type SeedKit = {
  slug: string;
  name: string;
  category: string;
  price: number;
  shortDescription: string;
  description: string;
  soldCount?: number;
  /** [sku del componente, cantidad (unidades o metros)] */
  items: [string, number][];
};

export const kits: SeedKit[] = [
  {
    slug: "kit-nuevo-enchufe",
    name: "Kit: agrega un enchufe nuevo",
    category: "enchufes",
    price: 19990,
    shortDescription: "Todo lo necesario para sacar un enchufe nuevo desde una caja existente.",
    description: "Incluye 10 m de cable 2,5 mm² en cada color (fase rojo, neutro blanco y tierra verde/amarillo), un enchufe doble y una caja de derivación.",
    soldCount: 95,
    items: [
      ["THHN25-RJ", 10],
      ["THHN25-BL", 10],
      ["THHN25-VA", 10],
      ["ENC10D-BL", 1],
      ["CAJ100-IP55", 1],
    ],
  },
  {
    slug: "kit-tablero-basico",
    name: "Kit: tablero básico de vivienda",
    category: "protecciones",
    price: 35990,
    shortDescription: "Diferencial + 3 automáticos para un tablero domiciliario.",
    description: "Un diferencial 2P 25 A 30 mA y tres disyuntores 1P 16 A curva C. La base de un tablero seguro.",
    soldCount: 60,
    items: [
      ["DIF2P25-30", 1],
      ["DIS1P16C", 3],
    ],
  },
];

export const shippingZones = [
  {
    name: "Santiago centro y oriente",
    comunas: ["Santiago", "Providencia", "Ñuñoa", "Las Condes", "Vitacura", "Lo Barnechea", "La Reina", "Macul", "San Miguel", "Estación Central"],
    price: 3990,
    freeShippingOver: 60000,
    estimatedDays: "1 a 2 días hábiles",
  },
  {
    name: "Resto de la Región Metropolitana",
    comunas: ["Maipú", "Puente Alto", "La Florida", "Peñalolén", "Quilicura", "Pudahuel", "San Bernardo", "Huechuraba", "Recoleta", "Independencia", "Cerrillos", "Lo Prado", "Quinta Normal", "Renca", "Conchalí", "La Cisterna", "San Joaquín", "Pedro Aguirre Cerda", "Lo Espejo", "El Bosque", "La Granja", "La Pintana", "San Ramón", "Cerro Navia", "Colina", "Lampa", "Buin", "Padre Hurtado", "Peñaflor", "Talagante"],
    price: 5990,
    freeShippingOver: 90000,
    estimatedDays: "2 a 3 días hábiles",
  },
  {
    name: "Resto de Chile",
    comunas: [] as string[],
    price: 9990,
    estimatedDays: "3 a 7 días hábiles",
    isFallback: true,
  },
];
