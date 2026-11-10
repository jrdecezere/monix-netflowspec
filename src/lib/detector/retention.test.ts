import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_RETENTION_HOURS,
  purgeOldFlows,
  retentionHours,
  type FlowTable,
} from "./retention";

const noSleep = async () => {};

test("retentionHours: padrão, desligado e mínimo", () => {
  assert.equal(retentionHours(undefined), DEFAULT_RETENTION_HOURS);
  assert.equal(retentionHours(""), DEFAULT_RETENTION_HOURS);
  assert.equal(retentionHours("abc"), DEFAULT_RETENTION_HOURS);
  assert.equal(retentionHours("-5"), DEFAULT_RETENTION_HOURS);
  assert.equal(retentionHours("0"), 0);
  assert.equal(retentionHours("0.2"), 1);
  assert.equal(retentionHours("24"), 24);
  assert.equal(retentionHours("36.9"), 36);
});

test("purgeOldFlows: repete lotes até um lote incompleto, em cada tabela", async () => {
  const stock: Record<FlowTable, number> = { flow_dst: 12_000, flow_src_port: 3_000 };
  const calls: string[] = [];
  const r = await purgeOldFlows(
    48,
    async (table, hours, limit) => {
      assert.equal(hours, 48);
      const n = Math.min(limit, stock[table]);
      stock[table] -= n;
      calls.push(table);
      return n;
    },
    { batchSize: 5000, sleep: noSleep },
  );
  assert.deepEqual(r.deleted, { flow_dst: 12_000, flow_src_port: 3_000 });
  assert.deepEqual(r.incomplete, []);
  assert.deepEqual(calls, ["flow_dst", "flow_dst", "flow_dst", "flow_src_port"]);
});

test("purgeOldFlows: respeita o teto de lotes e marca como incompleta", async () => {
  let calls = 0;
  const r = await purgeOldFlows(
    24,
    async (table, _h, limit) => {
      if (table === "flow_src_port") return 0;
      calls++;
      return limit; // sempre cheio: sobra muito para apagar
    },
    { batchSize: 100, maxBatches: 3, sleep: noSleep },
  );
  assert.equal(calls, 3);
  assert.equal(r.deleted.flow_dst, 300);
  assert.deepEqual(r.incomplete, ["flow_dst"]);
});

test("purgeOldFlows: erro numa tabela não impede a outra", async () => {
  const errors: string[] = [];
  const r = await purgeOldFlows(
    24,
    async (table) => {
      if (table === "flow_dst") throw new Error("boom");
      return 7;
    },
    { sleep: noSleep, onError: (t) => errors.push(t) },
  );
  assert.deepEqual(errors, ["flow_dst"]);
  assert.equal(r.deleted.flow_src_port, 7);
  assert.deepEqual(r.incomplete, ["flow_dst"]);
});

test("purgeOldFlows: horas 0 (desligado) não executa nada", async () => {
  let calls = 0;
  const r = await purgeOldFlows(0, async () => {
    calls++;
    return 1;
  });
  assert.equal(calls, 0);
  assert.deepEqual(r.deleted, { flow_dst: 0, flow_src_port: 0 });
});
