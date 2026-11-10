import "server-only";
import { prisma } from "./db";

/** Janela usada nas tabelas "top" e nos totais atuais. */
export const RECENT_SECONDS = 120;
/** Janela do gráfico, em minutos. */
export const SERIES_MINUTES = 60;

export type SeriesPoint = { ts: number; bps: number; pps: number };
export type TopDestination = {
  ip: string;
  bps: number;
  pps: number;
  fps: number; // fluxos/s
  udpShare: number; // 0..1 dos bytes
  synShare: number; // 0..1 dos pacotes TCP
};
export type TopSrcPort = {
  proto: string;
  port: number;
  bps: number;
  pps: number;
};
export type InterfaceRow = {
  exporter: string;
  ifIndex: number;
  bps: number;
  pps: number;
};
export type ExporterRow = { exporter: string; lastSeenSeconds: number };

const num = (v: unknown) => Number(v ?? 0);

/**
 * Executa uma consulta e, se ela falhar (ex.: estourou o tempo máximo), devolve
 * o valor vazio e anota um aviso em vez de derrubar a página inteira.
 */
async function guarded<T>(
  name: string,
  warnings: string[],
  fallback: T,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    const value = await fn();
    const ms = Date.now() - t0;
    if (ms > 3000) console.warn(`[traffic] consulta lenta: ${name} levou ${ms} ms`);
    return value;
  } catch (e) {
    const ms = Date.now() - t0;
    console.error(`[traffic] consulta falhou: ${name} (${ms} ms)`, e instanceof Error ? e.message : e);
    warnings.push(name);
    return fallback;
  }
}

// Série do gráfico: vem de traffic_minute (um registro por minuto, gravado pelo
// detector). Somar flow_dst direto custa minutos quando a tabela é grande.
// O minuto corrente ainda está sendo preenchido e fica de fora. Se o detector
// estiver desligado ou recém-instalado, o gráfico enche aos poucos.
export async function getSeries(): Promise<SeriesPoint[]> {
  const rows = await prisma.$queryRaw<
    { ts: unknown; bytes: unknown; packets: unknown }[]
  >`
    SELECT UNIX_TIMESTAMP(stamp) AS ts,
           CAST(bytes AS DOUBLE) AS bytes,
           CAST(packets AS DOUBLE) AS packets
      FROM traffic_minute
     WHERE stamp >= NOW() - INTERVAL ${SERIES_MINUTES} MINUTE
       AND stamp < DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:00')
     ORDER BY stamp`;
  return rows.map((r) => ({
    ts: num(r.ts),
    bps: (num(r.bytes) * 8) / 60,
    pps: num(r.packets) / 60,
  }));
}

export async function getTopDestinations(limit = 10): Promise<TopDestination[]> {
  const rows = await prisma.$queryRaw<
    {
      ip_dst: string;
      bytes: unknown;
      packets: unknown;
      flows: unknown;
      udp_bytes: unknown;
      tcp_packets: unknown;
      syn_packets: unknown;
    }[]
  >`
    SELECT ip_dst,
           CAST(SUM(bytes) AS DOUBLE) AS bytes,
           CAST(SUM(packets) AS DOUBLE) AS packets,
           CAST(SUM(flows) AS DOUBLE) AS flows,
           CAST(SUM(CASE WHEN ip_proto = 'udp' THEN bytes ELSE 0 END) AS DOUBLE) AS udp_bytes,
           CAST(SUM(CASE WHEN ip_proto = 'tcp' THEN packets ELSE 0 END) AS DOUBLE) AS tcp_packets,
           CAST(SUM(CASE WHEN ip_proto = 'tcp' AND (tcp_flags & 2) > 0
                         THEN packets ELSE 0 END) AS DOUBLE) AS syn_packets
      FROM flow_dst
     WHERE stamp_inserted >= NOW() - INTERVAL ${RECENT_SECONDS} SECOND
     GROUP BY ip_dst
     ORDER BY bytes DESC
     LIMIT ${limit}`;
  return rows.map((r) => ({
    ip: r.ip_dst.trim(),
    bps: (num(r.bytes) * 8) / RECENT_SECONDS,
    pps: num(r.packets) / RECENT_SECONDS,
    fps: num(r.flows) / RECENT_SECONDS,
    udpShare: num(r.bytes) ? num(r.udp_bytes) / num(r.bytes) : 0,
    synShare: num(r.tcp_packets) ? num(r.syn_packets) / num(r.tcp_packets) : 0,
  }));
}

export async function getTopSrcPorts(limit = 10): Promise<TopSrcPort[]> {
  const rows = await prisma.$queryRaw<
    { ip_proto: string; port_src: unknown; bytes: unknown; packets: unknown }[]
  >`
    SELECT ip_proto, port_src,
           CAST(SUM(bytes) AS DOUBLE) AS bytes,
           CAST(SUM(packets) AS DOUBLE) AS packets
      FROM flow_src_port
     WHERE stamp_inserted >= NOW() - INTERVAL ${RECENT_SECONDS} SECOND
     GROUP BY ip_proto, port_src
     ORDER BY bytes DESC
     LIMIT ${limit}`;
  return rows.map((r) => ({
    proto: r.ip_proto.trim(),
    port: num(r.port_src),
    bps: (num(r.bytes) * 8) / RECENT_SECONDS,
    pps: num(r.packets) / RECENT_SECONDS,
  }));
}

export async function getInterfaces(): Promise<InterfaceRow[]> {
  const rows = await prisma.$queryRaw<
    { peer_ip_src: string; iface_in: unknown; bytes: unknown; packets: unknown }[]
  >`
    SELECT peer_ip_src, iface_in,
           CAST(SUM(bytes) AS DOUBLE) AS bytes,
           CAST(SUM(packets) AS DOUBLE) AS packets
      FROM flow_dst
     WHERE stamp_inserted >= NOW() - INTERVAL ${RECENT_SECONDS} SECOND
     GROUP BY peer_ip_src, iface_in
     ORDER BY bytes DESC
     LIMIT 50`;
  return rows.map((r) => ({
    exporter: r.peer_ip_src.trim(),
    ifIndex: num(r.iface_in),
    bps: (num(r.bytes) * 8) / RECENT_SECONDS,
    pps: num(r.packets) / RECENT_SECONDS,
  }));
}

export async function getExporters(): Promise<ExporterRow[]> {
  const rows = await prisma.$queryRaw<
    { peer_ip_src: string; age: unknown }[]
  >`
    SELECT peer_ip_src,
           TIMESTAMPDIFF(SECOND, MAX(stamp_updated), NOW()) AS age
      FROM flow_dst
     WHERE stamp_inserted >= NOW() - INTERVAL 5 MINUTE
     GROUP BY peer_ip_src
     ORDER BY peer_ip_src`;
  return rows.map((r) => ({
    exporter: r.peer_ip_src.trim(),
    lastSeenSeconds: num(r.age),
  }));
}

async function loadTrafficOverview() {
  const warnings: string[] = [];
  // No máximo 2 consultas simultâneas: evita esgotar o pool de conexões quando
  // o banco está lento ou há vários usuários com a tela aberta.
  const [series, destinations] = await Promise.all([
    guarded("gráfico", warnings, [] as SeriesPoint[], getSeries),
    guarded("maiores destinos", warnings, [] as TopDestination[], () => getTopDestinations()),
  ]);
  const [srcPorts, interfaces] = await Promise.all([
    guarded("portas de origem", warnings, [] as TopSrcPort[], () => getTopSrcPorts()),
    guarded("interfaces", warnings, [] as InterfaceRow[], getInterfaces),
  ]);
  const exporters = await guarded("exportadores", warnings, [] as ExporterRow[], getExporters);

  // Totais "agora" = soma das interfaces na janela recente
  const totalBps = interfaces.reduce((s, i) => s + i.bps, 0);
  const totalPps = interfaces.reduce((s, i) => s + i.pps, 0);

  return {
    now: Math.floor(Date.now() / 1000),
    series,
    destinations,
    srcPorts,
    interfaces,
    exporters,
    totalBps,
    totalPps,
    warnings,
  };
}

// Várias pessoas (e o auto-atualizar de 15 s) pedem a mesma tela: calculamos uma
// vez a cada 10 s e todos reaproveitam, em vez de multiplicar consultas pesadas.
const OVERVIEW_TTL_MS = 10_000;
type Overview = Awaited<ReturnType<typeof loadTrafficOverview>>;
let overview: { at: number; value: Overview } | null = null;
let overviewInflight: Promise<Overview> | null = null;

export async function getTrafficOverview(): Promise<Overview> {
  if (overview && Date.now() - overview.at < OVERVIEW_TTL_MS) return overview.value;
  overviewInflight ??= loadTrafficOverview()
    .then((value) => {
      overview = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      overviewInflight = null;
    });
  return overviewInflight;
}
