// Utilitários de IPv4/CIDR (sem dependências).

export function parseIPv4(s: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
  if (!m) return null;
  let n = 0;
  for (let i = 1; i <= 4; i++) {
    const o = Number(m[i]);
    if (o > 255) return null;
    n = n * 256 + o;
  }
  return n;
}

export function formatIPv4(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export type ParsedCidr = {
  /** forma normalizada, ex.: 203.0.113.0/24 */
  cidr: string;
  bits: number;
  start: number;
  end: number;
};

/** Aceita "a.b.c.d/n" (n de 1 a 32) ou apenas "a.b.c.d" (= /32). */
export function parseCidr(input: string): ParsedCidr | null {
  const [ipPart, bitsPart, extra] = input.trim().split("/");
  if (extra !== undefined) return null;
  const ip = parseIPv4(ipPart ?? "");
  if (ip === null) return null;
  const bits = bitsPart === undefined ? 32 : Number(bitsPart);
  if (!Number.isInteger(bits) || bits < 1 || bits > 32 || bitsPart === "") {
    return null;
  }
  const size = 2 ** (32 - bits);
  const start = Math.floor(ip / size) * size;
  return {
    cidr: `${formatIPv4(start)}/${bits}`,
    bits,
    start,
    end: start + size - 1,
  };
}

/** Prefixo mais específico (maior máscara) que contém o IP, ou null. */
export function longestMatch<T extends { range: ParsedCidr }>(
  ip: string,
  list: T[],
): T | null {
  const n = parseIPv4(ip);
  if (n === null) return null;
  let best: T | null = null;
  for (const item of list) {
    if (n >= item.range.start && n <= item.range.end) {
      if (!best || item.range.bits > best.range.bits) best = item;
    }
  }
  return best;
}
