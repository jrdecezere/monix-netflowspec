// Cliente Prisma sem `server-only`: usado também pelo detector (instrumentation
// e scripts fora do Next). No app, importe sempre de "@/lib/db".
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

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
    // Pool maior que o padrão: o painel faz várias consultas em paralelo e o
    // detector roda no mesmo processo. Ajuste com DB_POOL_SIZE se precisar.
    connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
    // Espera por conexão livre (ms) antes de falhar; o padrão (10 s) é curto
    // para um banco ocupado gravando fluxos.
    acquireTimeout: 30_000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

// Sempre no global: em produção o Next separa o código do painel e o da
// instrumentation (detector) em bundles distintos, e cada um criaria seu pool.
globalForPrisma.prisma = prisma;
