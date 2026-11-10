"use client";

import { useState, useTransition } from "react";
import { BellRing, Loader2, Radar, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveAlerts, saveDetection, sendTestAlert } from "./actions";

export type DetectValues = {
  enabled: boolean;
  scope: "all" | "registered";
  bpsMbps: number;
  pps: number;
  synPps: number;
  windowSec: number;
  intervalSec: number;
  confirmTicks: number;
  clearTicks: number;
};

export type AlertValues = {
  hasToken: boolean;
  telegramChatId: string;
  webhookUrl: string;
  panelUrl: string;
};

const scopeItems = [
  { value: "all", label: "Todos os destinos" },
  { value: "registered", label: "Só prefixos cadastrados" },
];

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DetectionForm({ initial }: { initial: DetectValues }) {
  const [v, setV] = useState({
    enabled: initial.enabled,
    scope: initial.scope,
    bpsMbps: String(initial.bpsMbps),
    pps: String(initial.pps),
    synPps: String(initial.synPps),
    windowSec: String(initial.windowSec),
    intervalSec: String(initial.intervalSec),
    confirmTicks: String(initial.confirmTicks),
    clearTicks: String(initial.clearTicks),
  });
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  function save() {
    startTransition(async () => {
      const res = await saveDetection({
        enabled: v.enabled,
        scope: v.scope,
        bpsMbps: Number(v.bpsMbps),
        pps: Number(v.pps),
        synPps: Number(v.synPps),
        windowSec: Number(v.windowSec),
        intervalSec: Number(v.intervalSec),
        confirmTicks: Number(v.confirmTicks),
        clearTicks: Number(v.clearTicks),
      });
      if (res.ok) toast.success("Configuração de detecção salva");
      else toast.error(res.error);
    });
  }

  return (
    <section className="mb-8 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Radar className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold leading-tight">Limiares de detecção</h2>
          <p className="text-sm text-muted-foreground">
            Valem por IP de destino. Use 0 para desligar um limiar. Cada prefixo pode ter limites próprios.
          </p>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={v.enabled}
          onChange={(e) => setV((s) => ({ ...s, enabled: e.target.checked }))}
          className="size-4 accent-[var(--primary)]"
        />
        Detecção ativa (somente alerta, nada é alterado no roteador)
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="d-bps" label="Banda (Mbps)" hint="Padrão: 1000 = 1 Gbps">
          <Input id="d-bps" inputMode="decimal" value={v.bpsMbps} onChange={set("bpsMbps")} />
        </Field>
        <Field id="d-pps" label="Pacotes/s" hint="Padrão: 500000">
          <Input id="d-pps" inputMode="numeric" value={v.pps} onChange={set("pps")} />
        </Field>
        <Field id="d-syn" label="SYN/s" hint="Conta se SYN ≥ 50% do TCP">
          <Input id="d-syn" inputMode="numeric" value={v.synPps} onChange={set("synPps")} />
        </Field>
        <Field id="d-scope" label="Escopo">
          <Select
            items={scopeItems}
            value={v.scope}
            onValueChange={(val) => setV((s) => ({ ...s, scope: val as "all" | "registered" }))}
          >
            <SelectTrigger id="d-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopeItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="d-win" label="Janela de cálculo (s)" hint="Taxa média desse período">
          <Input id="d-win" inputMode="numeric" value={v.windowSec} onChange={set("windowSec")} />
        </Field>
        <Field id="d-int" label="Intervalo do ciclo (s)">
          <Input id="d-int" inputMode="numeric" value={v.intervalSec} onChange={set("intervalSec")} />
        </Field>
        <Field id="d-conf" label="Ciclos p/ abrir" hint="Seguidos acima do limiar">
          <Input id="d-conf" inputMode="numeric" value={v.confirmTicks} onChange={set("confirmTicks")} />
        </Field>
        <Field id="d-clear" label="Ciclos p/ encerrar" hint="Seguidos abaixo de 50%">
          <Input id="d-clear" inputMode="numeric" value={v.clearTicks} onChange={set("clearTicks")} />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="button" disabled={pending} onClick={save}>
          {pending && <Loader2 className="animate-spin" />}
          Salvar limiares
        </Button>
      </div>
    </section>
  );
}

export function AlertsForm({ initial }: { initial: AlertValues }) {
  const [token, setToken] = useState("");
  const [removeToken, setRemoveToken] = useState(false);
  const [chatId, setChatId] = useState(initial.telegramChatId);
  const [webhook, setWebhook] = useState(initial.webhookUrl);
  const [panel, setPanel] = useState(initial.panelUrl);
  const [pending, startTransition] = useTransition();
  const [testing, startTest] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveAlerts({
        telegramToken: token,
        removeTelegram: removeToken,
        telegramChatId: chatId,
        webhookUrl: webhook,
        panelUrl: panel,
      });
      if (res.ok) {
        toast.success("Alertas salvos");
        setToken("");
        setRemoveToken(false);
      } else toast.error(res.error);
    });
  }

  function test() {
    startTest(async () => {
      const res = await sendTestAlert();
      if (res.ok) toast.success(res.message ?? "Enviado");
      else toast.error(res.error);
    });
  }

  return (
    <section className="mb-8 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BellRing className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold leading-tight">Alertas</h2>
          <p className="text-sm text-muted-foreground">
            Mensagem ao abrir e ao encerrar um ataque. Salve antes de enviar o teste.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="a-token"
          label="Token do bot Telegram"
          hint={
            initial.hasToken && !removeToken
              ? "Token salvo. Deixe em branco para manter."
              : "Crie o bot com o @BotFather."
          }
        >
          <Input
            id="a-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={initial.hasToken ? "••••••••••" : "123456:ABC..."}
          />
          {initial.hasToken && (
            <label className="flex items-center gap-2 pt-1 text-xs">
              <input
                type="checkbox"
                checked={removeToken}
                onChange={(e) => setRemoveToken(e.target.checked)}
                className="size-3.5 accent-[var(--primary)]"
              />
              Remover token salvo
            </label>
          )}
        </Field>
        <Field id="a-chat" label="Chat ID do Telegram" hint="Pessoa, grupo (-100…) ou @canal">
          <Input id="a-chat" value={chatId} onChange={(e) => setChatId(e.target.value)} />
        </Field>
        <Field id="a-hook" label="Webhook (JSON via POST)" hint="Opcional. Slack/Discord/n8n etc.">
          <Input
            id="a-hook"
            type="url"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="https://..."
          />
        </Field>
        <Field id="a-panel" label="URL pública do painel" hint="Opcional: vira link na mensagem">
          <Input
            id="a-panel"
            type="url"
            value={panel}
            onChange={(e) => setPanel(e.target.value)}
            placeholder="https://painel.exemplo.com"
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={testing || pending} onClick={test}>
          {testing ? <Loader2 className="animate-spin" /> : <Send />}
          Enviar teste
        </Button>
        <Button type="button" disabled={pending} onClick={save}>
          {pending && <Loader2 className="animate-spin" />}
          Salvar alertas
        </Button>
      </div>
    </section>
  );
}
