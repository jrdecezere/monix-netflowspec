import { AppHeader } from "@/components/app-header";
import { requireAccess } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadConfig, readHeartbeatAge } from "@/lib/detector/config";
import { ADMIN_NAV } from "@/lib/nav";
import { AlertsForm, DetectionForm } from "./detection-forms";

export const metadata = { title: "Detecção · SOSISP" };
export const dynamic = "force-dynamic";

export default async function DetectionPage() {
  const me = await requireAccess("/admin");
  const [{ detect, alert }, age, openCount] = await Promise.all([
    loadConfig(),
    readHeartbeatAge(),
    prisma.attackEvent.count({ where: { status: "OPEN" } }),
  ]);

  const alive = age !== null && age <= Math.max(30, detect.intervalSec * 3);

  return (
    <div className="min-h-screen bg-white">
      <AppHeader user={me} section="Administração" nav={ADMIN_NAV} current="/admin/deteccao" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border bg-white px-5 py-3 text-sm shadow-sm">
          <span className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${alive ? "bg-emerald-500" : "bg-red-500"}`}
              aria-hidden
            />
            Detector: {alive ? "em execução" : age === null ? "nunca executou" : "parado"}
            {age !== null && (
              <span className="text-muted-foreground">(último ciclo há {age} s)</span>
            )}
          </span>
          <span>
            Ataques em andamento: <strong>{openCount}</strong>
          </span>
          <span className="text-muted-foreground">Fase 2: apenas alerta</span>
        </div>

        <DetectionForm
          initial={{
            enabled: detect.enabled,
            scope: detect.scope,
            bpsMbps: detect.bps / 1e6,
            pps: detect.pps,
            synPps: detect.synPps,
            windowSec: detect.windowSec,
            intervalSec: detect.intervalSec,
            confirmTicks: detect.confirmTicks,
            clearTicks: detect.clearTicks,
          }}
        />
        <AlertsForm
          initial={{
            hasToken: !!alert.telegramToken,
            telegramChatId: alert.telegramChatId,
            webhookUrl: alert.webhookUrl,
            panelUrl: alert.panelUrl,
          }}
        />
      </main>
    </div>
  );
}
