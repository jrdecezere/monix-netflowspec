import { prisma } from "@/lib/db-core";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de implantação (público, sem segredos): confere variáveis
 * obrigatórias, conexão com o banco e se as migrações foram aplicadas.
 * Abra /api/health no navegador quando a página der "server error".
 */
export async function GET() {
  const checks: Record<string, boolean | string | number> = {
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    DATABASE_URL: !!process.env.DATABASE_URL,
    database: false,
    migrations: false,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
    const users = await prisma.user.count();
    await prisma.attackEvent.count();
    checks.migrations = true;
    checks.users = users;
  } catch (e) {
    // só o tipo/código do erro: nunca a mensagem completa (pode ter host/usuário)
    const err = e as { code?: string; name?: string };
    checks.error = err.code ?? err.name ?? "erro";
    console.error("[health] falha:", e);
  }

  const ok = checks.SESSION_SECRET && checks.database && checks.migrations;
  return Response.json({ ok: !!ok, ...checks }, { status: ok ? 200 : 503 });
}
