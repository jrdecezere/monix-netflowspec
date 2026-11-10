// Converte os contadores acumulados dos baldes de 1 minuto do pmacct em taxas.
//
// Cada linha de flow_dst é um total acumulado do minuto (a mesma linha é
// atualizada a cada ~15 s). Guardamos o último total visto de cada (IP, balde)
// e registramos só a DIFERENÇA a cada ciclo; a taxa é a soma das diferenças da
// janela dividida pela janela.

export type Counters = {
  bytes: number;
  packets: number;
  flows: number;
  udpBytes: number;
  tcpPackets: number;
  synPackets: number;
  icmpPackets: number;
};

export type RowSample = Counters & { ip: string; stamp: number };

export const ZERO: Counters = {
  bytes: 0,
  packets: 0,
  flows: 0,
  udpBytes: 0,
  tcpPackets: 0,
  synPackets: 0,
  icmpPackets: 0,
};

const FIELDS = Object.keys(ZERO) as (keyof Counters)[];

/** Quanto tempo lembramos o último total de cada balde (> janela do SELECT). */
export const KEEP_LAST_SECONDS = 600;

type HistoryItem = { t: number; d: Counters };

export class RateTracker {
  private last = new Map<string, Counters>();
  private history = new Map<string, HistoryItem[]>();
  /** Na 1ª leitura os totais já existentes viram base (sem gerar "pico" falso). */
  private baselining = true;

  /** `now` em segundos. */
  ingest(rows: RowSample[], now: number) {
    for (const row of rows) {
      const key = `${row.ip}|${row.stamp}`;
      const prev = this.last.get(key);
      this.last.set(key, row);

      if (!prev && this.baselining) continue;

      const base = prev ?? ZERO;
      const delta = { ...ZERO };
      let any = false;
      for (const f of FIELDS) {
        const d = Math.max(0, row[f] - base[f]);
        delta[f] = d;
        if (d > 0) any = true;
      }
      if (!any) continue;

      const h = this.history.get(row.ip);
      if (h) h.push({ t: now, d: delta });
      else this.history.set(row.ip, [{ t: now, d: delta }]);
    }
    this.baselining = false;
  }

  /** Remove o que já saiu da janela de interesse. */
  prune(now: number, keepSeconds: number) {
    const cutoff = now - keepSeconds;
    for (const [ip, h] of this.history) {
      const kept = h.filter((x) => x.t > cutoff);
      if (kept.length === 0) this.history.delete(ip);
      else this.history.set(ip, kept);
    }
    // Totais de baldes antigos (stamp em epoch s) saem da memória. Deve ser bem
    // mais velho que a janela consultada no banco, senão a linha voltaria como
    // "nova" e seu total inteiro seria contado como tráfego recente.
    const lastCutoff = now - Math.max(keepSeconds, KEEP_LAST_SECONDS);
    for (const key of this.last.keys()) {
      const stamp = Number(key.slice(key.lastIndexOf("|") + 1));
      if (stamp < lastCutoff) this.last.delete(key);
    }
  }

  /** IPs com movimento dentro da janela. */
  activeIps(now: number, windowSec: number): string[] {
    const out: string[] = [];
    for (const [ip, h] of this.history) {
      if (h.some((x) => x.t > now - windowSec)) out.push(ip);
    }
    return out;
  }

  /** Soma das diferenças na janela (não dividida). */
  window(ip: string, now: number, windowSec: number): Counters {
    const total = { ...ZERO };
    for (const x of this.history.get(ip) ?? []) {
      if (x.t > now - windowSec) {
        for (const f of FIELDS) total[f] += x.d[f];
      }
    }
    return total;
  }
}
