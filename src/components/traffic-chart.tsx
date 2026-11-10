import { formatBps } from "@/lib/format";

type Point = { ts: number; value: number };

/** Gráfico de área em SVG puro (renderizado no servidor). */
export function TrafficChart({
  points,
  minutes,
  endTs,
  height = 220,
}: {
  points: Point[];
  minutes: number;
  /** instante final do eixo X (epoch, segundos) */
  endTs: number;
  height?: number;
}) {
  const W = 800;
  const H = height;
  const pad = { l: 64, r: 12, t: 12, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const t1 = endTs;
  const t0 = endTs - minutes * 60;
  const max = Math.max(1, ...points.map((p) => p.value)) * 1.15;

  const x = (ts: number) => pad.l + ((ts - t0) / (t1 - t0)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const line = sorted.map((p) => `${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`);
  const area =
    sorted.length > 0
      ? `M${x(sorted[0].ts).toFixed(1)},${y(0)} L${line.join(" L")} L${x(
          sorted[sorted.length - 1].ts,
        ).toFixed(1)},${y(0)} Z`
      : "";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const xTicks = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
  const fmtTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Gráfico de tráfego"
      className="h-auto w-full"
    >
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={y(v)}
            y2={y(v)}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
          <text
            x={pad.l - 8}
            y={y(v) + 4}
            textAnchor="end"
            fontSize={11}
            fill="currentColor"
            fillOpacity={0.55}
          >
            {formatBps(v)}
          </text>
        </g>
      ))}
      {xTicks.map((ts) => (
        <text
          key={ts}
          x={x(ts)}
          y={H - 6}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
          fillOpacity={0.55}
        >
          {fmtTime(ts)}
        </text>
      ))}

      {area && <path d={area} fill="var(--primary)" fillOpacity={0.15} />}
      {line.length > 0 && (
        <polyline
          points={line.join(" ")}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}
      {sorted.map((p) => (
        <circle key={p.ts} cx={x(p.ts)} cy={y(p.value)} r={2.5} fill="var(--primary)">
          <title>{`${fmtTime(p.ts)} · ${formatBps(p.value)}`}</title>
        </circle>
      ))}

      {sorted.length === 0 && (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          fontSize={13}
          fill="currentColor"
          fillOpacity={0.5}
        >
          Sem dados no período
        </text>
      )}
    </svg>
  );
}
