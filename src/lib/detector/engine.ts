// Motor de detecção: a cada ciclo lê os contadores do pmacct, calcula taxas por
// IP de destino, compara com os limiares e mantém os eventos (attack_events).
// Fase 2 = SÓ ALERTA: nada aqui altera o roteador.
import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db-core";
import { sendAlerts, type AlertPayload } from "./alerts";
import { loadConfig, writeHeartbeat, type DetectConfig } from "./config";
import { longestMatch, parseCidr, type ParsedCidr } from "./ip";
import {
  ATTACK_LABEL,
  AlertBudget,
  type AttackType,
  classify,
  computeRates,
  decide,
  effectiveLimits,
  exceeded,
  wellBelow,
  type IpState,
  type Limits,
  type Rates,
  type SrcPortHint,
} from "./rules";
import { RateTracker, type RowSample } from "./tracker";

/** Janela lida da tabela a cada ciclo (menor que o tempo de memória do tracker). */
const QUERY_MINUTES = 4;
const HISTORY_KEEP_SECONDS = 15 * 60;

type PrefixEntry = {
  name: string;
  ignore: boolean;
  limits: { bps: number | null; pps: number | null; synPps: number | null };
  range: ParsedCidr;
};

const n = (v: unknown) => Number(v ?? 0);

export type TickSummary = {
  at: number;
  tracked: number;
  opened: number;
  closed: number;
  open: number;
};

/** No máximo 20 alertas por minuto: evita inundar o Telegram se os limiares ficarem baixos. */
const ALERTS_PER_MINUTE = 20;

export class DetectorEngine {
  readonly tracker = new RateTracker();
  private states = new Map<string, IpState>();
  private budget = new AlertBudget(ALERTS_PER_MINUTE, 60);
  private log: (msg: string) => void;

  constructor(log: (msg: string) => void = (m) => console.log(`[detector] ${m}`)) {
    this.log = log;
  }

  async tick(nowSec = Math.floor(Date.now() / 1000)): Promise<TickSummary> {
    const { detect, alert } = await loadConfig();
    const summary: TickSummary = { at: nowSec, tracked: 0, opened: 0, closed: 0, open: 0 };

    await writeHeartbeat(nowSec);
    if (!detect.enabled) return summary;

    const rows = await this.readRows();
    this.tracker.ingest(rows, nowSec);
    this.tracker.prune(nowSec, HISTORY_KEEP_SECONDS);

    const prefixes = await this.loadPrefixes();
    const openEvents = await prisma.attackEvent.findMany({ where: { status: "OPEN" } });
    const openByIp = new Map(openEvents.map((e) => [e.targetIp, e]));

    const ips = new Set([
      ...this.tracker.activeIps(nowSec, detect.windowSec),
      ...openByIp.keys(),
    ]);
    summary.tracked = ips.size;

    for (const ip of ips) {
      const match = longestMatch(ip, prefixes);
      if (match?.ignore) continue;
      if (detect.scope === "registered" && !match) continue;

      const limits = effectiveLimits(
        { bps: detect.bps, pps: detect.pps, synPps: detect.synPps },
        match,
      );
      const rates = computeRates(this.tracker.window(ip, nowSec, detect.windowSec), detect.windowSec);
      const over = exceeded(rates, limits);
      const open = openByIp.get(ip);

      const prev = this.states.get(ip) ?? { above: 0, below: 0 };
      const { state, decision } = decide(
        prev,
        !!open,
        over.length > 0,
        wellBelow(rates, limits),
        detect,
      );
      if (state.above === 0 && state.below === 0) this.states.delete(ip);
      else this.states.set(ip, state);

      if (decision === "open") {
        await this.openEvent(ip, match?.name ?? null, rates, limits, over, detect, alert, nowSec);
        summary.opened++;
      } else if (decision === "keep" && open && over.length > 0) {
        await prisma.attackEvent.update({
          where: { id: open.id },
          data: {
            lastSeenAt: new Date(nowSec * 1000),
            peakBps: Math.max(open.peakBps, rates.bps),
            peakPps: Math.max(open.peakPps, rates.pps),
          },
        });
      } else if (decision === "close" && open) {
        const endedAt = new Date(nowSec * 1000);
        await prisma.attackEvent.update({
          where: { id: open.id },
          data: { status: "CLOSED", endedAt },
        });
        summary.closed++;
        this.log(`encerrado: ${ip} (${open.type})`);
        if (open.alertedAt && this.budget.take(nowSec)) {
          await sendAlerts(alert, payload("ended", open, endedAt)).catch(() => undefined);
        }
      }
    }

    summary.open = await prisma.attackEvent.count({ where: { status: "OPEN" } });
    return summary;
  }

  private async openEvent(
    ip: string,
    prefixName: string | null,
    rates: Rates,
    limits: Limits,
    over: string[],
    detect: DetectConfig,
    alertCfg: Awaited<ReturnType<typeof loadConfig>>["alert"],
    nowSec: number,
  ) {
    const hint = await this.topSrcPort(ip, rates, detect);
    const cls = classify(rates, hint);
    const now = new Date(nowSec * 1000);

    const evidence = {
      rates,
      limits,
      exceeded: over,
      windowSec: detect.windowSec,
      topSrcPort: hint,
    } as unknown as Prisma.InputJsonObject;

    const ev = await prisma.attackEvent.create({
      data: {
        targetIp: ip,
        prefixName,
        type: cls.type,
        status: "OPEN",
        startedAt: now,
        lastSeenAt: now,
        peakBps: rates.bps,
        peakPps: rates.pps,
        evidence,
      },
    });
    this.log(`ABERTO: ${ip} ${cls.label} ${Math.round(rates.bps / 1e6)} Mbps ${Math.round(rates.pps)} pps`);

    if (!this.budget.take(nowSec)) {
      const error = `limite de ${ALERTS_PER_MINUTE} alertas/min atingido (evento registrado, sem envio)`;
      await prisma.attackEvent.update({ where: { id: ev.id }, data: { alertError: error } });
      this.log(`${ip}: ${error}`);
      return;
    }
    const res = await sendAlerts(alertCfg, {
      ...payload("started", ev),
      label: cls.label,
    });
    if (res.delivered || res.error) {
      await prisma.attackEvent.update({
        where: { id: ev.id },
        data: {
          alertedAt: res.delivered ? new Date() : null,
          alertError: res.error ?? null,
        },
      });
    }
    if (res.error) this.log(`falha no alerta (${ip}): ${res.error}`);
  }

  private async readRows(): Promise<RowSample[]> {
    const rows = await prisma.$queryRaw<
      {
        ip_dst: string;
        stamp: unknown;
        bytes: unknown;
        packets: unknown;
        flows: unknown;
        udp_bytes: unknown;
        tcp_packets: unknown;
        syn_packets: unknown;
        icmp_packets: unknown;
      }[]
    >`
      SELECT ip_dst,
             UNIX_TIMESTAMP(stamp_inserted) AS stamp,
             CAST(SUM(bytes) AS DOUBLE) AS bytes,
             CAST(SUM(packets) AS DOUBLE) AS packets,
             CAST(SUM(flows) AS DOUBLE) AS flows,
             CAST(SUM(CASE WHEN ip_proto = 'udp' THEN bytes ELSE 0 END) AS DOUBLE) AS udp_bytes,
             CAST(SUM(CASE WHEN ip_proto = 'tcp' THEN packets ELSE 0 END) AS DOUBLE) AS tcp_packets,
             CAST(SUM(CASE WHEN ip_proto = 'tcp' AND (tcp_flags & 2) > 0 AND (tcp_flags & 16) = 0
                           THEN packets ELSE 0 END) AS DOUBLE) AS syn_packets,
             CAST(SUM(CASE WHEN ip_proto = 'icmp' THEN packets ELSE 0 END) AS DOUBLE) AS icmp_packets
        FROM flow_dst
       WHERE stamp_inserted >= NOW() - INTERVAL ${QUERY_MINUTES} MINUTE
       GROUP BY ip_dst, stamp_inserted`;
    return rows.map((r) => ({
      ip: r.ip_dst.trim(),
      stamp: n(r.stamp),
      bytes: n(r.bytes),
      packets: n(r.packets),
      flows: n(r.flows),
      udpBytes: n(r.udp_bytes),
      tcpPackets: n(r.tcp_packets),
      synPackets: n(r.syn_packets),
      icmpPackets: n(r.icmp_packets),
    }));
  }

  private async loadPrefixes(): Promise<PrefixEntry[]> {
    const list = await prisma.prefix.findMany();
    const out: PrefixEntry[] = [];
    for (const p of list) {
      const range = parseCidr(p.cidr);
      if (!range) continue;
      out.push({
        name: p.name,
        ignore: p.ignore,
        limits: { bps: p.bpsLimit, pps: p.ppsLimit, synPps: p.synPpsLimit },
        range,
      });
    }
    return out;
  }

  /**
   * Porta de origem dominante na rede (heurística para reconhecer amplificação).
   * A tabela de portas não tem destino; então usamos a fatia da porta sobre o
   * volume UDP do alvo no mesmo período, aplicada à taxa atual.
   */
  private async topSrcPort(
    ip: string,
    rates: Rates,
    detect: DetectConfig,
  ): Promise<SrcPortHint | null> {
    const period = detect.windowSec + 60;
    const [port] = await prisma.$queryRaw<
      { ip_proto: string; port_src: unknown; bytes: unknown }[]
    >`
      SELECT ip_proto, port_src, CAST(SUM(bytes) AS DOUBLE) AS bytes
        FROM flow_src_port
       WHERE stamp_inserted >= NOW() - INTERVAL ${period} SECOND
       GROUP BY ip_proto, port_src
       ORDER BY bytes DESC
       LIMIT 1`;
    if (!port) return null;
    const [target] = await prisma.$queryRaw<{ bytes: unknown }[]>`
      SELECT CAST(SUM(bytes) AS DOUBLE) AS bytes
        FROM flow_dst
       WHERE ip_dst = ${ip}
         AND stamp_inserted >= NOW() - INTERVAL ${period} SECOND`;
    const targetBytes = n(target?.bytes);
    if (targetBytes <= 0) return null;
    const share = Math.min(1, n(port.bytes) / targetBytes);
    return { proto: port.ip_proto.trim(), port: n(port.port_src), bps: rates.bps * share };
  }
}

function payload(
  kind: "started" | "ended",
  ev: {
    id: number;
    targetIp: string;
    prefixName: string | null;
    type: string;
    peakBps: number;
    peakPps: number;
    startedAt: Date;
  },
  endedAt?: Date,
): AlertPayload {
  return {
    kind,
    eventId: ev.id,
    targetIp: ev.targetIp,
    prefixName: ev.prefixName,
    type: ev.type,
    label: ATTACK_LABEL[ev.type as AttackType] ?? ev.type,
    peakBps: ev.peakBps,
    peakPps: ev.peakPps,
    startedAt: ev.startedAt,
    endedAt,
  };
}
