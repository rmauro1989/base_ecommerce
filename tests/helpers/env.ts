// Todos los módulos que usan `db` apuntan a la base de tests.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://tienda:tienda@localhost:5433/tienda_test";
