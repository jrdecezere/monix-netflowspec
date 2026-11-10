// Configuração da detecção e dos alertas, guardada na tabela `settings`.
import { prisma } from "../db-core";

export type DetectConfig = {
  enabled: boolean;
  /** janela de cálculo da taxa, em segundos */
  windowSec: number;
  /** intervalo entre ciclos do detector, em segundos */
  intervalSec: number;
  /** limiares globais (por IP de destino); 0 desliga o limiar */
  bps: number;
  pps: number;
  synPps: number;
  /** ciclos seguidos acima do limiar para abrir o evento */
  confirmTicks: number;
  /** ciclos seguidos bem abaixo (< 50%) para encerrar */
  clearTicks: number;
  /** "all": avalia qualquer destino; "registered": só IPs dentro dos prefixos cadastrados */
  scope: "all" | "registered";
};

export type AlertConfig = {
  telegramToken: string;
  telegramChatId: string;
  webhookUrl: string;
  /** URL pública do painel (vira link nas mensagens), opcional */
  panelUrl: string;
};

export const DETECT_DEFAULTS: DetectConfig = {
  enabled: true,
  windowSec: 60,
  intervalSec: 10,
  bps: 1_000_000_000, // 1 Gbps
  pps: 500_000,
  synPps: 50_000,
  confirmTicks: 2,
  clearTicks: 6,
  scope: "all",
};

export const ALERT_DEFAULTS: AlertConfig = {
  telegramToken: "",
  telegramChatId: "",
  webhookUrl: "",
  panelUrl: "",
};

const KEYS = {
  enabled: "detect.enabled",
  windowSec: "detect.windowSec",
  intervalSec: "detect.intervalSec",
  bps: "detect.bps",
  pps: "detect.pps",
  synPps: "detect.synPps",
  confirmTicks: "detect.confirmTicks",
  clearTicks: "detect.clearTicks",
  scope: "detect.scope",
  telegramToken: "alert.telegramToken",
  telegramChatId: "alert.telegramChatId",
  webhookUrl: "alert.webhookUrl",
  panelUrl: "alert.panelUrl",
} as const;

export const HEARTBEAT_KEY = "detect.lastTick";

function num(v: string | undefined, fallback: number) {
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function parseConfig(map: Record<string, string>): {
  detect: DetectConfig;
  alert: AlertConfig;
} {
  const d = DETECT_DEFAULTS;
  return {
    detect: {
      enabled: map[KEYS.enabled] === undefined ? d.enabled : map[KEYS.enabled] === "1",
      windowSec: num(map[KEYS.windowSec], d.windowSec) || d.windowSec,
      intervalSec: num(map[KEYS.intervalSec], d.intervalSec) || d.intervalSec,
      bps: num(map[KEYS.bps], d.bps),
      pps: num(map[KEYS.pps], d.pps),
      synPps: num(map[KEYS.synPps], d.synPps),
      confirmTicks: Math.max(1, Math.round(num(map[KEYS.confirmTicks], d.confirmTicks))),
      clearTicks: Math.max(1, Math.round(num(map[KEYS.clearTicks], d.clearTicks))),
      scope: map[KEYS.scope] === "registered" ? "registered" : "all",
    },
    alert: {
      telegramToken: map[KEYS.telegramToken] ?? "",
      telegramChatId: map[KEYS.telegramChatId] ?? "",
      webhookUrl: map[KEYS.webhookUrl] ?? "",
      panelUrl: map[KEYS.panelUrl] ?? "",
    },
  };
}

export async function loadConfig() {
  const rows = await prisma.setting.findMany({
    where: { OR: [{ key: { startsWith: "detect." } }, { key: { startsWith: "alert." } }] },
  });
  return parseConfig(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

async function put(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function saveDetectConfig(c: DetectConfig) {
  await Promise.all([
    put(KEYS.enabled, c.enabled ? "1" : "0"),
    put(KEYS.windowSec, String(c.windowSec)),
    put(KEYS.intervalSec, String(c.intervalSec)),
    put(KEYS.bps, String(c.bps)),
    put(KEYS.pps, String(c.pps)),
    put(KEYS.synPps, String(c.synPps)),
    put(KEYS.confirmTicks, String(c.confirmTicks)),
    put(KEYS.clearTicks, String(c.clearTicks)),
    put(KEYS.scope, c.scope),
  ]);
}

export async function saveAlertConfig(c: AlertConfig) {
  await Promise.all([
    put(KEYS.telegramToken, c.telegramToken),
    put(KEYS.telegramChatId, c.telegramChatId),
    put(KEYS.webhookUrl, c.webhookUrl),
    put(KEYS.panelUrl, c.panelUrl),
  ]);
}

export async function writeHeartbeat(epochSeconds: number) {
  await put(HEARTBEAT_KEY, String(epochSeconds));
}

export async function readHeartbeat(): Promise<number | null> {
  const row = await prisma.setting.findUnique({ where: { key: HEARTBEAT_KEY } });
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Segundos desde o último ciclo do detector (null = nunca rodou). */
export async function readHeartbeatAge(): Promise<number | null> {
  const beat = await readHeartbeat();
  return beat === null ? null : Math.max(0, Math.floor(Date.now() / 1000) - beat);
}

/** Valida URL de webhook/painel: só http(s). */
export function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
