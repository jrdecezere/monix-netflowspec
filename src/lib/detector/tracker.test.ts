import assert from "node:assert/strict";
import { test } from "node:test";
import { RateTracker, ZERO, type RowSample } from "./tracker";

const row = (ip: string, stamp: number, bytes: number, packets = 1): RowSample => ({
  ...ZERO,
  ip,
  stamp,
  bytes,
  packets,
});

test("a primeira leitura vira base e não gera taxa", () => {
  const t = new RateTracker();
  t.ingest([row("1.1.1.1", 60, 1_000_000)], 100);
  assert.equal(t.window("1.1.1.1", 100, 60).bytes, 0);
  assert.deepEqual(t.activeIps(100, 60), []);
});

test("só a diferença entre leituras do mesmo balde conta", () => {
  const t = new RateTracker();
  t.ingest([row("1.1.1.1", 60, 1000)], 100);
  t.ingest([row("1.1.1.1", 60, 1600)], 110);
  t.ingest([row("1.1.1.1", 60, 2500)], 120);
  assert.equal(t.window("1.1.1.1", 120, 60).bytes, 1500);
  // janela curta enxerga só o último passo
  assert.equal(t.window("1.1.1.1", 120, 5).bytes, 900);
});

test("balde novo (minuto seguinte) entra inteiro como tráfego novo", () => {
  const t = new RateTracker();
  t.ingest([row("1.1.1.1", 60, 1000)], 100);
  t.ingest([row("1.1.1.1", 60, 1000), row("1.1.1.1", 120, 400)], 130);
  assert.equal(t.window("1.1.1.1", 130, 60).bytes, 400);
});

test("IP novo depois da base entra inteiro", () => {
  const t = new RateTracker();
  t.ingest([row("1.1.1.1", 60, 10)], 100);
  t.ingest([row("2.2.2.2", 60, 777)], 110);
  assert.equal(t.window("2.2.2.2", 110, 60).bytes, 777);
});

test("contador que diminui não gera taxa negativa", () => {
  const t = new RateTracker();
  t.ingest([row("1.1.1.1", 60, 1000)], 100);
  t.ingest([row("1.1.1.1", 60, 200)], 110);
  assert.equal(t.window("1.1.1.1", 110, 60).bytes, 0);
});

test("prune descarta histórico antigo mas mantém a base dos baldes recentes", () => {
  const t = new RateTracker();
  t.ingest([row("1.1.1.1", 600, 1000)], 640);
  t.ingest([row("1.1.1.1", 600, 2000)], 650);
  t.prune(1000, 100);
  assert.equal(t.window("1.1.1.1", 1000, 900).bytes, 0);
  // balde de 600 s ainda "lembrado" (< 600 s de idade): sem dupla contagem
  t.ingest([row("1.1.1.1", 600, 2000)], 1000);
  assert.equal(t.window("1.1.1.1", 1000, 900).bytes, 0);
});
