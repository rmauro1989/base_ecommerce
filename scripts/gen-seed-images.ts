/**
 * Genera imágenes placeholder (SVG en escala de grises, sin colores de marca)
 * para los productos de ejemplo. Reemplázalas desde el admin con fotos reales.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { kits, products } from "../prisma/seed-data/catalog";

const icons: Record<string, string> = {
  cable: '<path d="M200 520 C 320 300, 480 740, 600 480" stroke="#5f6670" stroke-width="34" fill="none" stroke-linecap="round"/><circle cx="200" cy="520" r="34" fill="#9aa1aa"/><circle cx="600" cy="480" r="34" fill="#9aa1aa"/>',
  enchufe: '<rect x="250" y="230" width="300" height="300" rx="48" fill="none" stroke="#5f6670" stroke-width="22"/><circle cx="345" cy="380" r="22" fill="#5f6670"/><circle cx="455" cy="380" r="22" fill="#5f6670"/><rect x="388" y="430" width="24" height="50" rx="8" fill="#5f6670"/>',
  interruptor: '<rect x="270" y="210" width="260" height="340" rx="40" fill="none" stroke="#5f6670" stroke-width="22"/><rect x="345" y="290" width="110" height="180" rx="24" fill="#9aa1aa"/>',
  proteccion: '<rect x="300" y="190" width="200" height="380" rx="20" fill="none" stroke="#5f6670" stroke-width="22"/><rect x="365" y="300" width="70" height="120" rx="12" fill="#9aa1aa"/><path d="M400 470 l-30 50 h40 l-30 50" stroke="#5f6670" stroke-width="14" fill="none"/>',
  caja: '<rect x="230" y="250" width="340" height="280" rx="30" fill="none" stroke="#5f6670" stroke-width="22"/><circle cx="230" cy="390" r="26" fill="#9aa1aa"/><circle cx="570" cy="390" r="26" fill="#9aa1aa"/>',
  kit: '<rect x="220" y="300" width="360" height="250" rx="30" fill="none" stroke="#5f6670" stroke-width="22"/><path d="M330 300 v-60 h140 v60" stroke="#5f6670" stroke-width="22" fill="none"/><path d="M400 360 l-40 70 h55 l-35 70" stroke="#5f6670" stroke-width="16" fill="none"/>',
};

function iconFor(category: string, slug: string) {
  if (slug.startsWith("kit-")) return icons.kit;
  if (category.startsWith("cable")) return icons.cable;
  if (category === "enchufes") return icons.enchufe;
  if (category === "interruptores") return icons.interruptor;
  if (["protecciones", "disyuntores", "diferenciales"].includes(category)) return icons.proteccion;
  return icons.caja;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

mkdirSync("public/seed", { recursive: true });
for (const p of [...products, ...kits]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800"><rect width="800" height="800" fill="#eceef1"/>${iconFor(p.category, p.slug)}<text x="400" y="680" text-anchor="middle" font-family="system-ui, sans-serif" font-size="34" fill="#4a5059">${esc(p.name)}</text></svg>`;
  writeFileSync(`public/seed/${p.slug}.svg`, svg);
}
console.log(`Generadas ${products.length + kits.length} imágenes en public/seed/`);
