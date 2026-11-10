// Regras de detecção (funções puras, testáveis sem banco).
import { serviceInfo } from "../format";
import type { Counters } from "./tracker";

export type Limits = { bps: number; pps: number; synPps: number };

export type Rates = {
  bps: number;
  pps: number;
  fps: number;
  synPps: number;
  udpShare: number; // 0..1 dos bytes
  synShare: number; // 0..1 dos pacotes TCP
  icmpShare: number; // 0..1 dos pacotes
  avgPacketBytes: number;
};

export type AttackType =
  | "SYN_FLOOD"
  | "AMPLIFICATION"
  | "UDP_FLOOD"
  | "ICMP_FLOOD"
  | "VOLUMETRIC";

export const ATTACK_LABEL: Record<AttackType, string> = {
  SYN_FLOOD: "SYN flood",
  AMPLIFICATION: "Amplificação UDP",
  UDP_FLOOD: "UDP flood",
  ICMP_FLOOD: "ICMP flood",
  VOLUMETRIC: "Volumétrico",
};

export function computeRates(w: Counters, windowSec: number): Rates {
  return {
    bps: (w.bytes * 8) / windowSec,
    pps: w.packets / windowSec,
    fps: w.flows / windowSec,
    synPps: w.synPackets / windowSec,
    udpShare: w.bytes > 0 ? w.udpBytes / w.bytes : 0,
    synShare: w.tcpPackets > 0 ? w.synPackets / w.tcpPackets : 0,
    icmpShare: w.packets > 0 ? w.icmpPackets / w.packets : 0,
    avgPacketBytes: w.packets > 0 ? w.bytes / w.packets : 0,
  };
}

/** SYN-like: pacotes minúsculos (SYN tem 40-60 B) — o tcp_flags do pmacct é OR acumulado. */
export const SYN_MAX_AVG_PACKET = 100;

/** Quais limiares foram ultrapassados. SYN só conta se for maioria do TCP e de pacotes pequenos. */
export function exceeded(r: Rates, l: Limits): ("bps" | "pps" | "synPps")[] {
  const out: ("bps" | "pps" | "synPps")[] = [];
  if (l.bps > 0 && r.bps >= l.bps) out.push("bps");
  if (l.pps > 0 && r.pps >= l.pps) out.push("pps");
  if (l.synPps > 0 && r.synPps >= l.synPps && r.synShare >= 0.5 && r.avgPacketBytes <= SYN_MAX_AVG_PACKET) {
    out.push("synPps");
  }
  return out;
}

/** Abaixo de `factor` de todos os limiares (histerese para encerrar o evento). */
export function wellBelow(r: Rates, l: Limits, factor = 0.5): boolean {
  return (
    (l.bps <= 0 || r.bps < l.bps * factor) &&
    (l.pps <= 0 || r.pps < l.pps * factor) &&
    (l.synPps <= 0 || r.synPps < l.synPps * factor)
  );
}

/** Limites efetivos: o do prefixo, quando definido; senão o global. */
export function effectiveLimits(
  global: Limits,
  match: { limits: { bps: number | null; pps: number | null; synPps: number | null } } | null,
): Limits {
  return {
    bps: match?.limits.bps ?? global.bps,
    pps: match?.limits.pps ?? global.pps,
    synPps: match?.limits.synPps ?? global.synPps,
  };
}

/** Teto de alertas por janela móvel (proteção contra tempestade de mensagens). */
export class AlertBudget {
  private times: number[] = [];
  constructor(
    private readonly max: number,
    private readonly windowSec: number,
  ) {}

  /** Tenta consumir 1 alerta; false = estourou o teto. `now` em segundos. */
  take(now: number): boolean {
    this.times = this.times.filter((t) => t > now - this.windowSec);
    if (this.times.length >= this.max) return false;
    this.times.push(now);
    return true;
  }
}

export type IpState = { above: number; below: number };
export type Decision = "idle" | "open" | "keep" | "close";

/**
 * Ciclo de vida do evento de um IP, com histerese:
 * - abre após `confirmTicks` ciclos seguidos acima do limiar;
 * - fecha após `clearTicks` ciclos seguidos bem abaixo (< 50% dos limiares);
 * - entre 50% e 100% do limiar o evento aberto simplesmente continua.
 */
export function decide(
  state: IpState,
  isOpen: boolean,
  over: boolean,
  below: boolean,
  cfg: { confirmTicks: number; clearTicks: number },
): { state: IpState; decision: Decision } {
  if (over) {
    const above = state.above + 1;
    if (isOpen) return { state: { above, below: 0 }, decision: "keep" };
    if (above >= cfg.confirmTicks) {
      return { state: { above, below: 0 }, decision: "open" };
    }
    return { state: { above, below: 0 }, decision: "idle" };
  }
  if (!isOpen) return { state: { above: 0, below: 0 }, decision: "idle" };
  if (!below) return { state: { above: 0, below: 0 }, decision: "keep" };
  const b = state.below + 1;
  if (b >= cfg.clearTicks) return { state: { above: 0, below: b }, decision: "close" };
  return { state: { above: 0, below: b }, decision: "keep" };
}

export type SrcPortHint = { proto: string; port: number; bps: number };

/**
 * Classifica pelo perfil do tráfego. `topSrcPort` é a maior porta de origem da
 * rede inteira no momento: só vira "amplificação" se for uma porta conhecida de
 * reflexão e responder por ao menos metade da banda do alvo (atribuição provável).
 */
export function classify(
  r: Rates,
  topSrcPort?: SrcPortHint | null,
): { type: AttackType; label: string; port?: number } {
  if (r.synShare >= 0.5 && r.synPps >= 1000 && r.avgPacketBytes <= SYN_MAX_AVG_PACKET) {
    return { type: "SYN_FLOOD", label: ATTACK_LABEL.SYN_FLOOD };
  }
  if (r.udpShare >= 0.8) {
    if (topSrcPort && topSrcPort.proto === "udp" && topSrcPort.bps >= r.bps * 0.5) {
      const svc = serviceInfo("udp", topSrcPort.port);
      if (svc?.amplifier) {
        return {
          type: "AMPLIFICATION",
          label: `${ATTACK_LABEL.AMPLIFICATION} (${svc.name}/${topSrcPort.port})`,
          port: topSrcPort.port,
        };
      }
    }
    return { type: "UDP_FLOOD", label: ATTACK_LABEL.UDP_FLOOD };
  }
  if (r.icmpShare >= 0.5) {
    return { type: "ICMP_FLOOD", label: ATTACK_LABEL.ICMP_FLOOD };
  }
  return { type: "VOLUMETRIC", label: ATTACK_LABEL.VOLUMETRIC };
}
