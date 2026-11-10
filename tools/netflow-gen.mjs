#!/usr/bin/env node
// Gerador de NetFlow v5 para testar o coletor sem um roteador de verdade.
//
//   node tools/netflow-gen.mjs                       # tráfego normal (60 s)
//   node tools/netflow-gen.mjs --attack ntp          # + ataque NTP amplification
//   node tools/netflow-gen.mjs --attack syn --seconds 120
//
// Opções: --host 127.0.0.1  --port 2055  --seconds 60  --sampling 1000
//         --attack ntp|dns|memcached|syn   --victim 203.0.113.77
import dgram from "node:dgram";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]?.startsWith("--") ? "true" : (arr[i + 1] ?? "true")]);
    return acc;
  }, []),
);

const HOST = args.host ?? "127.0.0.1";
const PORT = Number(args.port ?? 2055);
const SECONDS = Number(args.seconds ?? 60);
const SAMPLING = Number(args.sampling ?? 1000);
const ATTACK = args.attack && args.attack !== "true" ? args.attack : null;
const VICTIM = args.victim ?? "203.0.113.77";

const ip = (s) => s.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
const rnd = (n) => Math.floor(Math.random() * n);
const rndIp = () => ((rnd(223) + 1) << 24 | rnd(256) << 16 | rnd(256) << 8 | (rnd(254) + 1)) >>> 0;
const UPLINK_IFINDEX = 10; // interface de entrada (uplink de trânsito)
const DOWNLINK_IFINDEX = 20;

const PROTO = { icmp: 1, tcp: 6, udp: 17 };
const ATTACKS = {
  ntp: { proto: PROTO.udp, srcPort: () => 123, dstPort: () => rnd(64000) + 1024, pkts: () => 40 + rnd(60), size: 468, flags: 0 },
  dns: { proto: PROTO.udp, srcPort: () => 53, dstPort: () => rnd(64000) + 1024, pkts: () => 40 + rnd(60), size: 1400, flags: 0 },
  memcached: { proto: PROTO.udp, srcPort: () => 11211, dstPort: () => rnd(64000) + 1024, pkts: () => 60 + rnd(80), size: 1400, flags: 0 },
  syn: { proto: PROTO.tcp, srcPort: () => rnd(64000) + 1024, dstPort: () => 443, pkts: () => 5 + rnd(10), size: 60, flags: 0x02 },
};

const start = Date.now();
let seq = 0;

function record({ src, dst, srcPort, dstPort, proto, pkts, size, flags, input }) {
  const b = Buffer.alloc(48);
  const uptime = Date.now() - start;
  b.writeUInt32BE(src, 0);
  b.writeUInt32BE(dst, 4);
  b.writeUInt32BE(0, 8); // nexthop
  b.writeUInt16BE(input, 12);
  b.writeUInt16BE(DOWNLINK_IFINDEX, 14);
  b.writeUInt32BE(pkts, 16);
  b.writeUInt32BE(pkts * size, 20);
  b.writeUInt32BE(Math.max(0, uptime - 1000), 24);
  b.writeUInt32BE(uptime, 28);
  b.writeUInt16BE(srcPort, 32);
  b.writeUInt16BE(dstPort, 34);
  b.writeUInt8(flags, 37);
  b.writeUInt8(proto, 38);
  return b;
}

function send(sock, records) {
  for (let i = 0; i < records.length; i += 30) {
    const chunk = records.slice(i, i + 30);
    const h = Buffer.alloc(24);
    const now = Date.now();
    h.writeUInt16BE(5, 0);
    h.writeUInt16BE(chunk.length, 2);
    h.writeUInt32BE(now - start, 4);
    h.writeUInt32BE(Math.floor(now / 1000), 8);
    h.writeUInt32BE((now % 1000) * 1e6, 12);
    h.writeUInt32BE(seq, 16);
    seq += chunk.length;
    h.writeUInt16BE((1 << 14) | SAMPLING, 22); // modo 1 = amostragem determinística 1:N
    sock.send(Buffer.concat([h, ...chunk]), PORT, HOST);
  }
}

// "Clientes" do provedor (destinos do tráfego normal)
const customers = Array.from({ length: 150 }, (_, i) => ip(`203.0.113.${(i % 250) + 1}`));
const WEB = [443, 443, 443, 80, 8080, 22, 53, 3389, 25, 993];

const sock = dgram.createSocket("udp4");
let t = 0;
const timer = setInterval(() => {
  const records = [];

  // Tráfego normal: muitos fluxos pequenos para vários clientes
  for (let i = 0; i < 120; i++) {
    const isUdp = Math.random() < 0.25;
    records.push(
      record({
        src: rndIp(),
        dst: customers[rnd(customers.length)],
        srcPort: WEB[rnd(WEB.length)],
        dstPort: rnd(64000) + 1024,
        proto: isUdp ? PROTO.udp : PROTO.tcp,
        pkts: 1 + rnd(8),
        size: 200 + rnd(1000),
        flags: isUdp ? 0 : 0x10 | (Math.random() < 0.1 ? 0x02 : 0),
        input: UPLINK_IFINDEX,
      }),
    );
  }

  // Ataque
  if (ATTACK && ATTACKS[ATTACK]) {
    const a = ATTACKS[ATTACK];
    for (let i = 0; i < 400; i++) {
      records.push(
        record({
          src: rndIp(),
          dst: ip(VICTIM),
          srcPort: a.srcPort(),
          dstPort: a.dstPort(),
          proto: a.proto,
          pkts: a.pkts(),
          size: a.size,
          flags: a.flags,
          input: UPLINK_IFINDEX,
        }),
      );
    }
  }

  send(sock, records);
  if (++t >= SECONDS) {
    clearInterval(timer);
    setTimeout(() => sock.close(), 200);
    console.log(`Fim: ${t}s enviados para ${HOST}:${PORT}${ATTACK ? ` (ataque ${ATTACK} -> ${VICTIM})` : ""}`);
  }
}, 1000);

console.log(`Enviando NetFlow v5 para ${HOST}:${PORT} por ${SECONDS}s, amostragem 1:${SAMPLING}${ATTACK ? `, ataque ${ATTACK} -> ${VICTIM}` : ""}`);
