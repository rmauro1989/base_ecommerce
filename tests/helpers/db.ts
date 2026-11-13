import { createPrismaClient } from "@/lib/db";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://tienda:tienda@localhost:5433/tienda_test";

export function testDb() {
  return createPrismaClient(TEST_DATABASE_URL);
}

/** Vacía todas las tablas de la base de tests. */
export async function truncateAll(prisma: ReturnType<typeof testDb>) {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
