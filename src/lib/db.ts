import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL no está definida");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Durante `next build` la base no está disponible (en Railway la red privada
 * no existe en el build). Si alguna página intenta consultarla, falla con un
 * mensaje claro: toda página que lea datos debe partir con `await connection()`.
 */
function buildGuard(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_t, prop) {
      if (prop === "then") return undefined;
      throw new Error(
        `[db] Se intentó usar la base durante el build (db.${String(prop)}). ` +
          'Agrega `await connection()` (de "next/server") al inicio de la página o generateMetadata.',
      );
    },
  });
}

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Cliente único (evita múltiples conexiones con el hot-reload de Next). */
export const db: PrismaClient = isBuild ? buildGuard() : (globalForPrisma.prisma ?? createPrismaClient());
if (!isBuild && process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
