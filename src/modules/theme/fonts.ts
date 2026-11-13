/**
 * Tipografías disponibles para el tema. Todas se declaran (sin precarga) y el
 * navegador solo descarga las que el tema activo realmente usa.
 * Para agregar una: cárgala aquí y regístrala en FONT_OPTIONS (tokens.ts).
 */
import {
  Archivo,
  Barlow,
  Barlow_Condensed,
  DM_Sans,
  IBM_Plex_Mono,
  Inter,
  JetBrains_Mono,
  Manrope,
  Plus_Jakarta_Sans,
  Space_Grotesk,
} from "next/font/google";

// next/font exige objetos literales (sin spread ni constantes compartidas).
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-space-grotesk" });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-plus-jakarta" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-manrope" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-dm-sans" });
const archivo = Archivo({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-archivo" });
const barlow = Barlow({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], variable: "--ff-barlow" });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600", "700"], variable: "--ff-barlow-condensed" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], display: "swap", preload: false, variable: "--ff-jetbrains-mono" });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500"], variable: "--ff-ibm-plex-mono" });

/** Clases que declaran las variables --ff-* en <html>. */
export const fontVariablesClassName = [
  inter,
  spaceGrotesk,
  plusJakarta,
  manrope,
  dmSans,
  archivo,
  barlow,
  barlowCondensed,
  jetbrainsMono,
  ibmPlexMono,
]
  .map((f) => f.variable)
  .join(" ");
