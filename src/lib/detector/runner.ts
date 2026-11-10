// Laço do detector: um ciclo a cada `intervalSec` (configurável no painel),
// sem sobreposição, com singleton por processo.
import { prisma } from "../db-core";
import { loadConfig } from "./config";
import { DetectorEngine } from "./engine";

const g = globalThis as unknown as { __detectorStarted?: boolean };

export function startDetector() {
  if (g.__detectorStarted) return;
  g.__detectorStarted = true;

  const engine = new DetectorEngine();
  let failures = 0;

  const loop = async () => {
    let delaySec = 10;
    try {
      const { detect } = await loadConfig();
      delaySec = detect.intervalSec;
      await engine.tick();
      failures = 0;
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
