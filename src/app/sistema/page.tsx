import Link from "next/link";
import { Activity, AlertTriangle, Gauge, Lock, Network, Radio, Server, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { TrafficChart } from "@/components/traffic-chart";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAccess } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { SYSTEM_NAV } from "@/lib/nav";
import {
  formatBps,
  formatNumber,
  formatPercent,
  formatPps,
  serviceInfo,
} from "@/lib/format";
import { getTrafficOverview, RECENT_SECONDS, SERIES_MINUTES } from "@/lib/traffic";
import { AutoRefresh } from "./auto-refresh";

export const metadata = { title: "Tráfego · SOSISP" };
export const dynamic = "force-dynamic";

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function SistemaPage() {
  const user = await requireAccess("/sistema");
  const canEdit = user.role === "USER";
  const [data, openAttacks] = await Promise.all([
    getTrafficOverview(),
    prisma.attackEvent.count({ where: { status: "OPEN" } }),
  ]);
  const hasData = data.exporters.length > 0;
  const activeExporters = data.exporters.filter((e) => e.lastSeenSeconds < 120);
  const top = data.destinations[0];

  return (
    <div className="min-h-screen bg-white">
      <AppHeader
        user={user}
        section="Monitoramento de tráfego"
        nav={SYSTEM_NAV}
        current="/sistema"
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {openAttacks > 0 && (
          <Link
            href="/sistema/eventos"
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100"
          >
            <ShieldAlert className="size-4 shrink-0" />
            <span>
              <strong>{openAttacks}</strong>{" "}
              {openAttacks === 1 ? "possível ataque em andamento" : "possíveis ataques em andamento"}
              . Ver detalhes
            </span>
          </Link>
        )}

        {data.warnings.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              O banco demorou demais para responder: <strong>{data.warnings.join(", ")}</strong>{" "}
              não puderam ser carregados agora e aparecem vazios. A página tenta de novo
              sozinha. Se persistir, veja Administração → Diagnóstico.
            </span>
          </div>
        )}

        {!canEdit && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-xl border border-primary/30 bg-secondary px-4 py-3 text-sm text-secondary-foreground"
          >
            <Lock className="size-4 shrink-0" />
            Você está em modo <strong>somente leitura</strong> (Convidado).
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tráfego</h1>
            <p className="text-sm text-muted-foreground">
              Fluxos recebidos dos roteadores (NetFlow/IPFIX), estimados pela taxa
              de amostragem.
            </p>
          </div>
          <AutoRefresh seconds={15} />
        </div>

        {!hasData && (
          <Card>
            <CardHeader>
              <CardTitle>Nenhum fluxo recebido ainda</CardTitle>
              <CardDescription>
                Configure o roteador para exportar NetStream/NetFlow para o IP
                deste servidor na porta <code>2055/udp</code>. Para testar sem
                roteador: <code>node tools/netflow-gen.mjs --attack ntp</code>
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            icon={Activity}
            label={`Tráfego (média ${RECENT_SECONDS / 60} min)`}
            value={formatBps(data.totalBps)}
          />
          <Kpi icon={Gauge} label="Pacotes" value={formatPps(data.totalPps)} />
          <Kpi
            icon={Network}
            label="Maior destino"
            value={top ? top.ip : "—"}
            hint={top ? `${formatBps(top.bps)} · ${formatPps(top.pps)}` : undefined}
          />
          <Kpi
            icon={Server}
            label="Exportadores ativos"
            value={`${activeExporters.length} de ${data.exporters.length}`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tráfego de entrada</CardTitle>
            <CardDescription>
              Últimos {SERIES_MINUTES} minutos, em bits por segundo (média por minuto)
            </CardDescription>
          </CardHeader>
          <CardContent className="text-foreground">
            <TrafficChart
              minutes={SERIES_MINUTES}
              endTs={data.now}
              points={data.series.map((p) => ({ ts: p.ts, value: p.bps }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maiores destinos</CardTitle>
            <CardDescription>
              Quem mais recebe tráfego (últimos {RECENT_SECONDS / 60} min). SYN alto
              e muito UDP são sinais de ataque.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP de destino</TableHead>
                  <TableHead className="text-right">Banda</TableHead>
                  <TableHead className="text-right">Pacotes</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Fluxos/s</TableHead>
                  <TableHead className="text-right">UDP</TableHead>
                  <TableHead className="text-right">SYN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.destinations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                      Sem dados no período.
                    </TableCell>
                  </TableRow>
                )}
                {data.destinations.map((d) => (
                  <TableRow key={d.ip}>
                    <TableCell className="font-mono text-sm">{d.ip}</TableCell>
                    <TableCell className="text-right font-medium">{formatBps(d.bps)}</TableCell>
                    <TableCell className="text-right">{formatPps(d.pps)}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {formatNumber(d.fps)}
                    </TableCell>
                    <TableCell className="text-right">{formatPercent(d.udpShare)}</TableCell>
                    <TableCell className="text-right">
                      {d.synShare >= 0.5 ? (
                        <Badge className="bg-red-50 text-red-700">{formatPercent(d.synShare)}</Badge>
                      ) : (
                        formatPercent(d.synShare)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Portas de origem</CardTitle>
              <CardDescription>
                Portas de amplificação (DNS, NTP, Memcached...) em destaque
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Banda</TableHead>
                    <TableHead className="text-right">Pacotes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.srcPorts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                        Sem dados no período.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.srcPorts.map((p) => {
                    const svc = serviceInfo(p.proto, p.port);
                    return (
                      <TableRow key={`${p.proto}/${p.port}`}>
                        <TableCell>
                          <span className="font-mono text-sm uppercase">
                            {p.proto}/{p.port}
                          </span>
                          {svc && (
                            <span className="ml-2 text-sm text-muted-foreground">{svc.name}</span>
                          )}
                          {svc?.amplifier && (
                            <Badge className="ml-2 bg-amber-50 text-amber-700">amplificação</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatBps(p.bps)}</TableCell>
                        <TableCell className="text-right">{formatPps(p.pps)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interfaces e exportadores</CardTitle>
              <CardDescription>
                Interface de entrada (ifIndex) por roteador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exportador</TableHead>
                    <TableHead>ifIndex</TableHead>
                    <TableHead className="text-right">Banda</TableHead>
                    <TableHead className="text-right">Pacotes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.interfaces.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                        Sem dados no período.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.interfaces.map((i) => (
                    <TableRow key={`${i.exporter}/${i.ifIndex}`}>
                      <TableCell className="font-mono text-sm">{i.exporter}</TableCell>
                      <TableCell>{i.ifIndex}</TableCell>
                      <TableCell className="text-right font-medium">{formatBps(i.bps)}</TableCell>
                      <TableCell className="text-right">{formatPps(i.pps)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="space-y-2 border-t border-border pt-3">
                {data.exporters.map((e) => {
                  const ok = e.lastSeenSeconds < 120;
                  return (
                    <div key={e.exporter} className="flex items-center gap-2 text-sm">
                      <Radio className={`size-4 ${ok ? "text-emerald-600" : "text-muted-foreground"}`} />
                      <span className="font-mono">{e.exporter}</span>
                      <span className="text-muted-foreground">
                        {ok ? "recebendo fluxos" : `sem dados há ${Math.round(e.lastSeenSeconds / 60)} min`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
