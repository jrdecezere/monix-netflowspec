// Laço do detector: um ciclo a cada `intervalSec` (configurável no painel),
// sem sobreposição, com singleton por processo.
import { prisma } from "../db-core";
import { loadConfig } from "./config";
import { DetectorEngine } from "./engine";
import { purgeOldFlows, retentionHours } from "./retention";
import { deleteFlowBatch } from "./retention-db";

const g = globalThis as unknown as { __detectorStarted?: boolean };

export function startDetector() {
  if (g.__detectorStarted) return;
  g.__detectorStarted = true;

  const engine = new DetectorEngine();
  let failures = 0;

  // Limpeza das tabelas de fluxo: a cada 10 min, em segundo plano (não atrasa os
  // ciclos de detecção) e nunca duas ao mesmo tempo.
  const PURGE_EVERY_MS = 10 * 60 * 1000;
  let lastPurge = 0;
  let purging = false;
  const maybePurge = () => {
    const hours = retentionHours();
    if (hours <= 0 || purging || Date.now() - lastPurge < PURGE_EVERY_MS) return;
    purging = true;
    lastPurge = Date.now();
    purgeOldFlows(hours, deleteFlowBatch, {
      onError: (table, e) =>
        console.error(`[detector] limpeza de ${table} falhou:`, e instanceof Error ? e.message : e),
    })
      .then((r) => {
        const total = r.deleted.flow_dst + r.deleted.flow_src_port;
        if (total > 0 || r.incomplete.length > 0) {
          console.log(
            `[detector] limpeza (> ${hours} h): flow_dst=${r.deleted.flow_dst}, ` +
              `flow_src_port=${r.deleted.flow_src_port}` +
              (r.incomplete.length ? ` (continua na próxima rodada: ${r.incomplete.join(", ")})` : ""),
          );
        }
      })
      .catch((e) => console.error("[detector] limpeza falhou:", e instanceof Error ? e.message : e))
      .finally(() => {
        purging = false;
      });
  };

  const loop = async () => {
    let delaySec = 10;
    try {
      const { detect } = await loadConfig();
      delaySec = detect.intervalSec;
      await engine.tick();
      failures = 0;
      maybePurge();
    } catch (e) {
      failures++;
      // evita inundar o log quando o banco está fora do ar
      if (failures === 1 || failures % 30 === 0) {
        console.error("[detector] erro no ciclo:", e instanceof Error ? e.message : e);
      }
    }
    const t = setTimeout(loop, Math.max(2, delaySec) * 1000);
    t.unref?.();
  };

  console.log("[detector] iniciado");
  const first = setTimeout(loop, 3000);
  first.unref?.();

  const stop = async () => {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignora */
    }
  };
  process.once("SIGTERM", () => void stop());
}
