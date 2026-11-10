// Limpeza das tabelas de fluxo (flow_dst e flow_src_port): sem ela as tabelas
// crescem para sempre e o banco degrada com o tempo. Apaga em lotes pequenos,
// pela chave primária (stamp_inserted vem primeiro, então é uma faixa de índice),
// com pausa entre lotes para não competir com as gravações do coletor.
//
// Este arquivo não importa o Prisma (para poder ser testado sem banco); quem
// executa o DELETE de verdade é `deleteFlowBatch`, em retention-db.ts.

export const FLOW_TABLES = ["flow_dst", "flow_src_port"] as const;
export type FlowTable = (typeof FLOW_TABLES)[number];

export const DEFAULT_RETENTION_HOURS = 48;
/** Mínimo quando ligado: o detector precisa de alguns minutos de histórico. */
export const MIN_RETENTION_HOURS = 1;
export const BATCH_SIZE = 5000;
/** Teto por tabela em cada rodada (200 mil linhas): uma limpeza atrasada é feita aos poucos. */
export const MAX_BATCHES_PER_TABLE = 40;
export const PAUSE_MS = 200;

/** Quantas horas de fluxo guardar. 0 desliga a limpeza (env FLOW_RETENTION_HOURS). */
export function retentionHours(raw: string | undefined = process.env.FLOW_RETENTION_HOURS): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_RETENTION_HOURS;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return DEFAULT_RETENTION_HOURS;
  if (v === 0) return 0;
  return Math.max(MIN_RETENTION_HOURS, Math.floor(v));
}

export type DeleteBatch = (table: FlowTable, hours: number, limit: number) => Promise<number>;

export type PurgeResult = {
  deleted: Record<FlowTable, number>;
  /** tabelas em que ainda sobrou lixo antigo (bateu o teto de lotes ou deu erro) */
  incomplete: FlowTable[];
};

/**
 * Apaga as linhas com mais de `hours` horas. `deleteBatch` apaga até `limit`
 * linhas e devolve quantas apagou; um lote menor que `limit` encerra a tabela.
 */
export async function purgeOldFlows(
  hours: number,
  deleteBatch: DeleteBatch,
  opts: {
    batchSize?: number;
    maxBatches?: number;
    pauseMs?: number;
    sleep?: (ms: number) => Promise<void>;
    onError?: (table: FlowTable, e: unknown) => void;
  } = {},
): Promise<PurgeResult> {
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const maxBatches = opts.maxBatches ?? MAX_BATCHES_PER_TABLE;
  const pauseMs = opts.pauseMs ?? PAUSE_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const result: PurgeResult = { deleted: { flow_dst: 0, flow_src_port: 0 }, incomplete: [] };
  if (hours <= 0) return result;

  for (const table of FLOW_TABLES) {
    let batches = 0;
    let finished = false;
    try {
      while (batches < maxBatches) {
        const n = await deleteBatch(table, hours, batchSize);
        batches++;
        result.deleted[table] += n;
        if (n < batchSize) {
          finished = true;
          break;
        }
        await sleep(pauseMs);
      }
    } catch (e) {
      opts.onError?.(table, e);
    }
    if (!finished) result.incomplete.push(table);
  }
  return result;
}
