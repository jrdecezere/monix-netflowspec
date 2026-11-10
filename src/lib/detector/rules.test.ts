import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AlertBudget,
  classify,
  computeRates,
  decide,
  effectiveLimits,
  exceeded,
  wellBelow,
  type IpState,
} from "./rules";
import { ZERO } from "./tracker";

const limits = { bps: 1e9, pps: 500_000, synPps: 50_000 };

test("computeRates converte totais da janela em taxas", () => {
  const r = computeRates(
    { ...ZERO, bytes: 7_500_000_000, packets: 6_000_000, udpBytes: 7_500_000_000 },
    60,
  );
  assert.equal(r.bps, 1e9);
  assert.equal(r.pps, 100_000);
  assert.equal(r.udpShare, 1);
  assert.equal(r.avgPacketBytes, 1250);
});

test("exceeded respeita cada limiar e ignora os desligados (0)", () => {
  const base = computeRates(ZERO, 60);
  assert.deepEqual(exceeded({ ...base, bps: 2e9 }, limits), ["bps"]);
  assert.deepEqual(exceeded({ ...base, pps: 600_000 }, limits), ["pps"]);
  assert.deepEqual(exceeded({ ...base, bps: 2e9 }, { ...limits, bps: 0 }), []);
});

test("SYN só conta quando é maioria do TCP (evita falso positivo de tráfego normal)", () => {
  const base = computeRates(ZERO, 60);
  assert.deepEqual(exceeded({ ...base, synPps: 60_000, synShare: 0.9 }, limits), ["synPps"]);
  assert.deepEqual(exceeded({ ...base, synPps: 60_000, synShare: 0.1 }, limits), []);
});

test("wellBelow usa histerese de 50%", () => {
  const base = computeRates(ZERO, 60);
  assert.equal(wellBelow({ ...base, bps: 4e8 }, limits), true);
  assert.equal(wellBelow({ ...base, bps: 6e8 }, limits), false);
});

test("classify: SYN flood, amplificação, UDP flood, ICMP e volumétrico", () => {
  const z = computeRates(ZERO, 60);
  assert.equal(classify({ ...z, synShare: 0.95, synPps: 80_000 }).type, "SYN_FLOOD");

  const udp = { ...z, bps: 2e9, udpShare: 0.99 };
  const amp = classify(udp, { proto: "udp", port: 123, bps: 1.9e9 });
  assert.equal(amp.type, "AMPLIFICATION");
  assert.equal(amp.port, 123);
  assert.match(amp.label, /NTP/);

  // porta conhecida mas pequena demais frente ao alvo: não atribui
  assert.equal(classify(udp, { proto: "udp", port: 123, bps: 1e8 }).type, "UDP_FLOOD");
  // porta que não é de amplificação (QUIC)
  assert.equal(classify(udp, { proto: "udp", port: 443, bps: 1.9e9 }).type, "UDP_FLOOD");
  assert.equal(classify({ ...z, bps: 1e9, icmpShare: 0.9 }).type, "ICMP_FLOOD");
  assert.equal(classify({ ...z, bps: 1e9, udpShare: 0.3 }).type, "VOLUMETRIC");
});

const cfg = { confirmTicks: 2, clearTicks: 3 };
const none: IpState = { above: 0, below: 0 };

test("decide: abre só depois de confirmTicks ciclos acima", () => {
  const a = decide(none, false, true, false, cfg);
  assert.equal(a.decision, "idle");
  const b = decide(a.state, false, true, false, cfg);
  assert.equal(b.decision, "open");
});

test("decide: um ciclo isolado acima do limiar não abre evento", () => {
  const a = decide(none, false, true, false, cfg);
  const b = decide(a.state, false, false, true, cfg);
  assert.equal(b.decision, "idle");
  assert.deepEqual(b.state, none);
});

test("decide: fecha só após clearTicks ciclos bem abaixo; zona intermediária mantém aberto", () => {
  let s = none;
  let d = decide(s, true, false, true, cfg);
  assert.equal(d.decision, "keep");
  s = d.state;
  // volta à zona cinza (50%–100%): zera a contagem de queda
  d = decide(s, true, false, false, cfg);
  assert.equal(d.decision, "keep");
  assert.equal(d.state.below, 0);
  s = d.state;
  for (let i = 0; i < 2; i++) {
    d = decide(s, true, false, true, cfg);
    assert.equal(d.decision, "keep");
    s = d.state;
  }
  d = decide(s, true, false, true, cfg);
  assert.equal(d.decision, "close");
});

test("decide: voltar a passar do limiar zera a contagem de encerramento", () => {
  let d = decide({ above: 0, below: 2 }, true, true, false, cfg);
  assert.equal(d.decision, "keep");
  assert.equal(d.state.below, 0);
  d = decide(d.state, true, false, true, cfg);
  assert.equal(d.decision, "keep");
});

test("effectiveLimits: prefixo sobrescreve só o que define; o resto vem do global", () => {
  assert.deepEqual(effectiveLimits(limits, null), limits);
  assert.deepEqual(
    effectiveLimits(limits, { limits: { bps: 5e9, pps: null, synPps: 0 } }),
    { bps: 5e9, pps: 500_000, synPps: 0 },
  );
});

test("AlertBudget: respeita o teto e libera depois da janela", () => {
  const b = new AlertBudget(2, 60);
  assert.equal(b.take(100), true);
  assert.equal(b.take(110), true);
  assert.equal(b.take(120), false);
  assert.equal(b.take(161), true); // o de t=100 saiu da janela
});

test("SYN exige pacotes pequenos: tráfego TCP de dados grandes não vira SYN flood", () => {
  const z = computeRates(ZERO, 60);
  const big = { ...z, synShare: 0.95, synPps: 80_000, avgPacketBytes: 900 };
  assert.deepEqual(exceeded(big, limits), []);
  assert.notEqual(classify({ ...big, bps: 1e9 }).type, "SYN_FLOOD");
  const small = { ...big, avgPacketBytes: 60 };
  assert.deepEqual(exceeded(small, limits), ["synPps"]);
});
