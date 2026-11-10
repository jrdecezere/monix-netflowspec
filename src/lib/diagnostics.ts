import "server-only";
import { prisma } from "./db";
import { readRecentRows } from "./detector/read-rows";
import {
  getExporters,
  getInterfaces,
  getSeries,
  getTopDestinations,
  getTopSrcPorts,
} from "./traffic";

export type Timing = { name: string; ms: number; rows?: number; error?: string };
export type Diagnostics = {
  timings: Timing[];
  facts: { label: string; value: string }[];
  perMinute: { stamp: string; rows: number }[];
  running: { id: number; seconds: number; info: string }[];
};

const num = (v: unknown) => Number(v ?? 0);

async function time(name: string, fn: () => Promise<unknown>): Promise<Timing> {
  const t0 = Date.now();
  try {
    const out = await fn();
    return { name, ms: Date.now() - t0, rows: Array.isArray(out) ? out.length : undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { name, ms: Date.now() - t0, error: msg.split("\n").pop()?.slice(0, 160) };
  }
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Mede, no banco real, cada consulta que o painel e o detector fazem. */
export async function runDiagnostics(): Promise<Diagnostics> {
  // sequencial de propósito: cada medida é isolada, sem competir entre si
  const timings: Timing[] = [];
  timings.push(await time("Detector: leitura dos últimos 2 min", readRecentRows));
  timings.push(await time("Tela: gráfico (traffic_minute)", getSeries));
  timings.push(await time("Tela: maiores destinos", () => getTopDestinations()));
  timings.push(await time("Tela: portas de origem", () => getTopSrcPorts()));
  timings.push(await time("Tela: interfaces", getInterfaces));
  timings.push(await time("Tela: exportadores", getExporters));

  const [version] = await safe(
    () => prisma.$queryRaw<{ v: string }[]>`SELECT VERSION() AS v`,
    [{ v: "?" }],
  );
  const [pool] = await safe(
    () => prisma.$queryRaw<{ v: unknown }[]>`SELECT CAST(@@innodb_buffer_pool_size AS DOUBLE) AS v`,
    [{ v: 0 }],
  );
  const pk = await safe(
    () =>
      prisma.$queryRaw<{ t: string; c: string }[]>`
        SELECT TABLE_NAME AS t, COLUMN_NAME AS c
          FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME = 'PRIMARY' AND SEQ_IN_INDEX = 1
           AND TABLE_NAME IN ('flow_dst', 'flow_src_port')`,
    [],
  );
  const sizes = await safe(
    () =>
      prisma.$queryRaw<{ t: string; r: unknown; d: unknown; i: unknown }[]>`
        SELECT TABLE_NAME AS t, CAST(TABLE_ROWS AS DOUBLE) AS r,
               CAST(DATA_LENGTH AS DOUBLE) AS d, CAST(INDEX_LENGTH AS DOUBLE) AS i
          FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN ('flow_dst', 'flow_src_port', 'traffic_minute')`,
    [],
  );
  const perMinute = await safe(
    () =>
      prisma.$queryRaw<{ s: string; n: unknown }[]>`
        SELECT DATE_FORMAT(stamp_inserted, '%H:%i') AS s, CAST(COUNT(*) AS DOUBLE) AS n
          FROM flow_dst
         WHERE stamp_inserted >= NOW() - INTERVAL 5 MINUTE
         GROUP BY stamp_inserted ORDER BY stamp_inserted`,
    [],
  );
  const running = await safe(
    () =>
      prisma.$queryRaw<{ id: unknown; t: unknown; q: string | null }[]>`
        SELECT CAST(ID AS DOUBLE) AS id, CAST(TIME AS DOUBLE) AS t, LEFT(INFO, 110) AS q
          FROM information_schema.PROCESSLIST
         WHERE COMMAND <> 'Sleep' AND ID <> CONNECTION_ID() AND INFO IS NOT NULL
         ORDER BY TIME DESC LIMIT 10`,
    [],
  );

  const mb = (v: unknown) => `${(num(v) / 1048576).toFixed(0)} MB`;
  const facts = [
    { label: "MySQL", value: version?.v ?? "?" },
    { label: "Buffer pool do InnoDB", value: mb(pool?.v) },
    ...pk.map((p) => ({
      label: `Chave primária de ${p.t} começa por`,
      value: p.c === "stamp_inserted" ? `${p.c} (correto)` : `${p.c} (ERRADO: migração não aplicada?)`,
    })),
    ...sizes.map((s) => ({
      label: `Tabela ${s.t}`,
      value: `~${Math.round(num(s.r)).toLocaleString("pt-BR")} linhas, dados ${mb(s.d)}, índices ${mb(s.i)}`,
    })),
  ];

  return {
    timings,
    facts,
    perMinute: perMinute.map((m) => ({ stamp: m.s, rows: num(m.n) })),
    running: running.map((r) => ({ id: num(r.id), seconds: num(r.t), info: r.q ?? "" })),
  };
}
