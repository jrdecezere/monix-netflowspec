import { ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/app-header";
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
import { ATTACK_LABEL, type AttackType } from "@/lib/detector/rules";
import { formatBps, formatPps } from "@/lib/format";
import { SYSTEM_NAV } from "@/lib/nav";
import { AutoRefresh } from "../auto-refresh";

export const metadata = { title: "Ataques · SOSISP" };
export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  bps: "banda",
  pps: "pacotes",
  synPps: "SYN",
};

const dtf = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

function duration(from: Date, to: Date) {
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function reasons(evidence: unknown): string {
  const ex = (evidence as { exceeded?: string[] } | null)?.exceeded;
  return Array.isArray(ex) ? ex.map((k) => REASON[k] ?? k).join(", ") : "—";
}

export default async function EventosPage() {
  const user = await requireAccess("/sistema");
  const events = await prisma.attackEvent.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  const now = new Date();
  const open = events.filter((e) => e.status === "OPEN").length;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader
        user={user}
        section="Monitoramento de tráfego"
        nav={SYSTEM_NAV}
        current="/sistema/eventos"
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ataques</h1>
            <p className="text-sm text-muted-foreground">
              Possíveis ataques detectados pelos limiares. Nesta fase o sistema só
              alerta: nenhuma ação é tomada no roteador.
            </p>
          </div>
          <AutoRefresh seconds={15} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-primary" />
              Eventos recentes
            </CardTitle>
            <CardDescription>
              {open} em andamento · últimos {events.length} eventos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead className="hidden sm:table-cell">Duração</TableHead>
                  <TableHead className="text-right">Pico banda</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Pico pacotes</TableHead>
                  <TableHead className="hidden lg:table-cell">Motivo</TableHead>
                  <TableHead className="hidden lg:table-cell">Alerta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-20 text-center text-muted-foreground">
                      Nenhum ataque detectado até agora.
                    </TableCell>
                  </TableRow>
                )}
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      {e.status === "OPEN" ? (
                        <Badge className="bg-red-50 text-red-700">Em andamento</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Encerrado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{e.targetIp}</span>
                      {e.prefixName && (
                        <span className="block text-xs text-muted-foreground">{e.prefixName}</span>
                      )}
                    </TableCell>
                    <TableCell>{ATTACK_LABEL[e.type as AttackType] ?? e.type}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{dtf.format(e.startedAt)}</TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">
                      {duration(e.startedAt, e.endedAt ?? now)}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatBps(e.peakBps)}</TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {formatPps(e.peakPps)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{reasons(e.evidence)}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {e.alertedAt ? (
                        <Badge className="bg-emerald-50 text-emerald-700">enviado</Badge>
                      ) : e.alertError ? (
                        <span title={e.alertError}>
                          <Badge className="bg-amber-50 text-amber-700">falhou</Badge>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">sem canal</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
