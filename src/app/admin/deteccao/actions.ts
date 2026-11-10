"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/dal";
import { sendAlerts } from "@/lib/detector/alerts";
import {
  isHttpUrl,
  loadConfig,
  saveAlertConfig,
  saveDetectConfig,
} from "@/lib/detector/config";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const detectSchema = z
  .object({
    enabled: z.boolean(),
    scope: z.enum(["all", "registered"], { message: "Escopo inválido" }),
    bpsMbps: z.number().min(0, "Valor inválido").max(10_000_000, "Valor alto demais"),
    pps: z.number().int("Use número inteiro").min(0).max(10_000_000_000),
    synPps: z.number().int("Use número inteiro").min(0).max(10_000_000_000),
    windowSec: z.number().int().min(10, "Janela mínima: 10 s").max(600, "Janela máxima: 600 s"),
    intervalSec: z.number().int().min(2, "Intervalo mínimo: 2 s").max(120, "Intervalo máximo: 120 s"),
    confirmTicks: z.number().int().min(1).max(30),
    clearTicks: z.number().int().min(1).max(120),
  })
  .refine((v) => v.intervalSec <= v.windowSec, {
    message: "O intervalo do ciclo não pode ser maior que a janela de cálculo",
    path: ["intervalSec"],
  });

export async function saveDetection(input: unknown): Promise<ActionResult> {
  await requireRole("ADMIN");
  const parsed = detectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { bpsMbps, ...rest } = parsed.data;
  await saveDetectConfig({ ...rest, bps: Math.round(bpsMbps * 1e6) });
  revalidatePath("/admin/deteccao");
  return { ok: true };
}

const alertSchema = z.object({
  /** vazio = manter o token atual */
  telegramToken: z.string().trim().max(120, "Token longo demais"),
  removeTelegram: z.boolean(),
  telegramChatId: z
    .string()
    .trim()
    .max(64)
    .refine((v) => v === "" || /^-?\d+$/.test(v) || /^@\w+$/.test(v), {
      message: "Chat ID inválido (número, ex.: -1001234567890, ou @canal)",
    }),
  webhookUrl: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || isHttpUrl(v), { message: "Webhook deve ser uma URL http(s)" }),
  panelUrl: z
    .string()
    .trim()
    .max(255)
    .refine((v) => v === "" || isHttpUrl(v), { message: "URL do painel deve ser http(s)" }),
});

export async function saveAlerts(input: unknown): Promise<ActionResult> {
  await requireRole("ADMIN");
  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const v = parsed.data;
  const { alert } = await loadConfig();

  const token = v.removeTelegram ? "" : v.telegramToken || alert.telegramToken;
  if (token && !/^\d+:[\w-]{20,}$/.test(token)) {
    return { ok: false, error: "Token do bot inválido (formato 123456:ABC...)" };
  }
  if (token && !v.telegramChatId) {
    return { ok: false, error: "Informe também o Chat ID do Telegram" };
  }

  await saveAlertConfig({
    telegramToken: token,
    telegramChatId: v.telegramChatId,
    webhookUrl: v.webhookUrl,
    panelUrl: v.panelUrl,
  });
  revalidatePath("/admin/deteccao");
  return { ok: true };
}

/** Envia um alerta de teste pelos canais salvos (ação explícita do admin). */
export async function sendTestAlert(): Promise<ActionResult> {
  await requireRole("ADMIN");
  const { alert } = await loadConfig();
  const res = await sendAlerts(alert, {
    kind: "started",
    eventId: 0,
    targetIp: "192.0.2.1",
    prefixName: "TESTE",
    type: "VOLUMETRIC",
    label: "Alerta de teste (nenhum ataque real)",
    peakBps: 1.5e9,
    peakPps: 250_000,
    startedAt: new Date(),
  });
  if (!res.configured) {
    return { ok: false, error: "Nenhum canal configurado (salve Telegram e/ou webhook antes)" };
  }
  if (!res.delivered) return { ok: false, error: res.error ?? "Falha no envio" };
  return { ok: true, message: "Alerta de teste enviado" };
}
