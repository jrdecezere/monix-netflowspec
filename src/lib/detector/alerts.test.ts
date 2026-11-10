import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { buildMessage, sendAlerts, type AlertPayload } from "./alerts";

// (sem importar config.ts para não instanciar o Prisma nos testes)
const ALERT_DEFAULTS = {
  telegramToken: "",
  telegramChatId: "",
  webhookUrl: "",
  panelUrl: "",
};

const payload: AlertPayload = {
  kind: "started",
  eventId: 7,
  targetIp: "203.0.113.77",
  prefixName: "Clientes A",
  type: "AMPLIFICATION",
  label: "Amplificação UDP (NTP/123)",
  peakBps: 2.4e9,
  peakPps: 300_000,
  startedAt: new Date("2026-11-10T12:00:00Z"),
};

test("mensagem traz alvo, tipo, pico e link do painel", () => {
  const m = buildMessage(payload, "https://painel.exemplo/");
  assert.match(m, /203\.0\.113\.77 \(Clientes A\)/);
  assert.match(m, /NTP\/123/);
  assert.match(m, /Gbps/);
  assert.match(m, /https:\/\/painel\.exemplo\/sistema\/eventos/);
  assert.match(buildMessage({ ...payload, kind: "ended", endedAt: new Date() }, ""), /encerrado/);
});

test("sem canal configurado: não há entrega nem erro", async () => {
  const r = await sendAlerts(ALERT_DEFAULTS, payload);
  assert.deepEqual(r, { configured: false, delivered: false, error: undefined });
});

test("webhook recebe JSON e conta como entregue", async () => {
  let body = "";
  const srv = createServer((req, res) => {
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200);
      res.end("ok");
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as AddressInfo).port;
  try {
    const r = await sendAlerts(
      { ...ALERT_DEFAULTS, webhookUrl: `http://127.0.0.1:${port}/hook` },
      payload,
    );
    assert.equal(r.delivered, true);
    const j = JSON.parse(body);
    assert.equal(j.event, "attack_started");
    assert.equal(j.target, "203.0.113.77");
    assert.equal(j.peak_bps, 2.4e9);
  } finally {
    srv.close();
  }
});

test("webhook com erro HTTP registra falha", async () => {
  const srv = createServer((_, res) => {
    res.writeHead(500);
    res.end("boom");
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as AddressInfo).port;
  try {
    const r = await sendAlerts(
      { ...ALERT_DEFAULTS, webhookUrl: `http://127.0.0.1:${port}/x` },
      payload,
    );
    assert.equal(r.configured, true);
    assert.equal(r.delivered, false);
    assert.match(r.error ?? "", /webhook: HTTP 500/);
  } finally {
    srv.close();
  }
});
