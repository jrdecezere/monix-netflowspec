import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  // Sem DATABASE_URL (ex.: durante o build em CI) usamos um valor de fachada:
  // nada conecta até a primeira consulta, que então falha com erro claro.
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL não definida: consultas ao banco vão falhar.");
  }
  const url = new URL(
    process.env.DATABASE_URL ?? "mysql://unset:unset@127.0.0.1:3306/unset",
  );
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 5,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
