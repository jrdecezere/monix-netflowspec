import { Stethoscope } from "lucide-react";
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
import { runDiagnostics } from "@/lib/diagnostics";
import { ADMIN_NAV } from "@/lib/nav";

export const metadata = { title: "Diagnóstico · SOSISP" };
export const dynamic = "force-dynamic";

export default async function DiagnosticPage() {
  const me = await requireAccess("/admin");
  const d = await runDiagnostics();

  return (
    <div className="min-h-screen bg-white">
      <AppHeader user={me} section="Administração" nav={ADMIN_NAV} current="/admin/diagnostico" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Stethoscope className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Diagnóstico do banco</h1>
            <p className="text-sm text-muted-foreground">
              Mede, agora, cada consulta que o painel e o detector fazem. Recarregue a página para medir de novo.
              Consultas acima de 20 s são canceladas.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tempo de cada consulta</CardTitle>
            <CardDescription>Normal: menos de 1 s. Acima de 3 s o painel já fica lento.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consulta</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.timings.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="text-right font-mono">{t.ms.toLocaleString("pt-BR")} ms</TableCell>
                    <TableCell className="text-right">{t.rows ?? "—"}</TableCell>
                    <TableCell>
                      {t.error ? (
                        <span className="text-sm text-red-700">{t.error}</span>
                      ) : t.ms > 3000 ? (
                        <Badge className="bg-amber-50 text-amber-700">lenta</Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700">ok</Badge>
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
              <CardTitle>Banco e tabelas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {d.facts.map((f) => (
                <div key={f.label} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="text-right font-medium">{f.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linhas gravadas por minuto</CardTitle>
              <CardDescription>
                Quantas linhas o coletor grava em flow_dst a cada minuto (últimos 5). Número muito alto
                (centenas de milhares) deixa tudo lento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {d.perMinute.length === 0 && (
                <p className="text-muted-foreground">Nenhuma linha nos últimos 5 minutos.</p>
              )}
              {d.perMinute.map((m) => (
                <div key={m.stamp} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <span className="font-mono text-muted-foreground">{m.stamp}</span>
                  <span className="font-medium">{m.rows.toLocaleString("pt-BR")} linhas</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consultas em execução agora</CardTitle>
            <CardDescription>Do MySQL (as mais demoradas primeiro).</CardDescription>
          </CardHeader>
          <CardContent>
            {d.running.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma consulta ativa no momento.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Há</TableHead>
                    <TableHead>Consulta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.running.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-mono">{r.seconds} s</TableCell>
                      <TableCell className="font-mono text-xs">{r.info}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
