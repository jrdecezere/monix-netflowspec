// Leitura das linhas recentes de flow_dst (compartilhada pelo detector e pela
// página de diagnóstico). A chave primária começa por stamp_inserted, então
// esta leitura é uma varredura sequencial dos últimos baldes.
import { prisma } from "../db-core";
import type { RowSample } from "./tracker";

/** Janela lida a cada ciclo: balde corrente + anterior (o último flush do
 *  pmacct chega até ~15 s depois do fim do minuto). */
export const QUERY_MINUTES = 2;

const n = (v: unknown) => Number(v ?? 0);

export async function readRecentRows(): Promise<RowSample[]> {
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
           CAST(SUM(CASE WHEN ip_proto = 'tcp' AND (tcp_flags & 2) > 0
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
