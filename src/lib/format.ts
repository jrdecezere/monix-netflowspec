const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function scale(value: number, units: string[], step = 1000) {
  let v = value;
  let i = 0;
  while (v >= step && i < units.length - 1) {
    v /= step;
    i++;
  }
  return `${v >= 100 || i === 0 ? nf0.format(v) : nf1.format(v)} ${units[i]}`;
}

/** bits por segundo → "1,2 Gbps" */
export const formatBps = (bps: number) =>
  scale(bps, ["bps", "Kbps", "Mbps", "Gbps", "Tbps"]);

/** pacotes por segundo → "350 Kpps" */
export const formatPps = (pps: number) =>
  scale(pps, ["pps", "Kpps", "Mpps", "Gpps"]);

export const formatNumber = (n: number) => nf0.format(n);

export const formatPercent = (ratio: number) =>
  `${nf1.format(Math.max(0, Math.min(1, ratio)) * 100)}%`;

/** Serviços conhecidos por porta, com marca para portas de amplificação (reflexão). */
const SERVICES: Record<string, { name: string; amplifier?: boolean }> = {
  "udp/19": { name: "Chargen", amplifier: true },
  "udp/53": { name: "DNS", amplifier: true },
  "udp/111": { name: "Portmap", amplifier: true },
  "udp/123": { name: "NTP", amplifier: true },
  "udp/137": { name: "NetBIOS", amplifier: true },
  "udp/161": { name: "SNMP", amplifier: true },
  "udp/389": { name: "CLDAP", amplifier: true },
  "udp/1900": { name: "SSDP", amplifier: true },
  "udp/3702": { name: "WS-Discovery", amplifier: true },
  "udp/5353": { name: "mDNS", amplifier: true },
  "udp/11211": { name: "Memcached", amplifier: true },
  "udp/443": { name: "QUIC" },
  "tcp/20": { name: "FTP-data" },
  "tcp/21": { name: "FTP" },
  "tcp/22": { name: "SSH" },
  "tcp/23": { name: "Telnet" },
  "tcp/25": { name: "SMTP" },
  "tcp/53": { name: "DNS" },
  "tcp/80": { name: "HTTP" },
  "tcp/110": { name: "POP3" },
  "tcp/143": { name: "IMAP" },
  "tcp/443": { name: "HTTPS" },
  "tcp/465": { name: "SMTPS" },
  "tcp/587": { name: "Submission" },
  "tcp/993": { name: "IMAPS" },
  "tcp/995": { name: "POP3S" },
  "tcp/3306": { name: "MySQL" },
  "tcp/3389": { name: "RDP" },
  "tcp/8080": { name: "HTTP-alt" },
};

export function serviceInfo(proto: string, port: number) {
  return SERVICES[`${proto}/${port}`] ?? null;
}
