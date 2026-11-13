import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { fontVariablesClassName } from "@/modules/theme/fonts";
import { themeToCss } from "@/modules/theme/resolve";
import { getActiveTheme, getStoreSettings } from "@/modules/theme/server";
import "./globals.css";

/*
 * La tienda se renderiza al momento de cada visita: los datos vienen de la
 * base, que no está disponible durante el build en Railway. Por eso TODA
 * página que lea datos parte con `await connection()` (ver src/lib/db.ts).
 * Las lecturas usan "use cache" + tags, así que igual son rápidas.
 */
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const s = await getStoreSettings();
  return {
    title: { default: s.storeName, template: `%s · ${s.storeName}` },
    description: s.seoDescription ?? undefined,
    icons: s.faviconUrl ? { icon: s.faviconUrl } : undefined,
    applicationName: s.storeName,
  };
}

/**
 * Límite dinámico: todo lo que está debajo se renderiza por request (nunca en
 * el build) e inyecta las variables CSS del tema activo.
 */
async function ThemedApp({ children }: { children: React.ReactNode }) {
  await connection();
  const theme = await getActiveTheme();
  return (
    <>
      <style href="theme-vars" precedence="high">
        {themeToCss(theme)}
      </style>
      {children}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={`${fontVariablesClassName} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={null}>
          <ThemedApp>{children}</ThemedApp>
        </Suspense>
      </body>
    </html>
  );
}
