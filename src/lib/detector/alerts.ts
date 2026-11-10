// Envio de alertas: Telegram e/ou webhook genérico (JSON).
import { formatBps, formatPps } from "../format";
import type { AlertConfig } from "./config";

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type AlertPayload = {
  kind: "started" | "ended";
  eventId: number;
  targetIp: string;
  prefixName: string | null;
  type: string;
  label: string;
  peakBps: number;
  peakPps: number;
  startedAt: Date;
  endedAt?: Date;
};

export type AlertResult = {
  /** havia ao menos um canal configurado */
  configured: boolean;
  /** todos os canais configurados responderam OK */
  delivered: boolean;
  error?: string;
};

const TIMEOUT_MS = 8000;

export function buildMessage(p: AlertPayload, panelUrl: string): string {
  const where = p.prefixName ? `${p.targetIp} (${p.prefixName})` : p.targetIp;
  const head =
    p.kind === "started"
      ? `🚨 Possível ataque DDoS: ${where}`
      : `✅ Ataque encerrado: ${where}`;
  const lines = [
    head,
    `Tipo: ${p.label}`,
    `Pico: ${formatBps(p.peakBps)} / ${formatPps(p.peakPps)}`,
    `Início: ${p.startedAt.toISOString()}`,
  ];
  if (p.endedAt) lines.push(`Fim: ${p.endedAt.toISOString()}`);
  if (panelUrl) lines.push(`Painel: ${panelUrl.replace(/\/+$/, "")}/sistema/eventos`);
  return lines.join("\n");
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 120);
    throw new Error(`HTTP ${res.status} ${text}`.trim());
  }
}

export async function sendAlerts(
  cfg: AlertConfig,
  p: AlertPayload,
): Promise<AlertResult> {
  const text = buildMessage(p, cfg.panelUrl);
  const errors: string[] = [];
  let configured = false;

  if (cfg.telegramToken && cfg.telegramChatId) {
    configured = true;
    try {
      await post(
        `https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`,
        { chat_id: cfg.telegramChatId, text, disable_web_page_preview: true },
      );
    } catch (e) {
      errors.push(`telegram: ${scrub(e, cfg.telegramToken)}`);
    }
  }

  if (cfg.webhookUrl && isHttpUrl(cfg.webhookUrl)) {
    configured = true;
    try {
      await post(cfg.webhookUrl, {
        event: p.kind === "started" ? "attack_started" : "attack_ended",
        id: p.eventId,
        target: p.targetIp,
        prefix: p.prefixName,
        type: p.type,
        label: p.label,
        peak_bps: Math.round(p.peakBps),
        peak_pps: Math.round(p.peakPps),
        started_at: p.startedAt.toISOString(),
        ended_at: p.endedAt?.toISOString() ?? null,
        text,
      });
    } catch (e) {
      errors.push(`webhook: ${scrub(e)}`);
    }
  }

  return {
    configured,
    delivered: configured && errors.length === 0,
    error: errors.length ? errors.join("; ").slice(0, 255) : undefined,
  };
}

function scrub(e: unknown, secret?: string) {
  let m = e instanceof Error ? e.message : String(e);
  if (secret) m = m.split(secret).join("***");
  return m;
}
