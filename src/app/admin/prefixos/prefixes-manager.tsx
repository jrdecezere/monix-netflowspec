"use client";

import { useState, useTransition } from "react";
import { Loader2, Network, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { createPrefix, deletePrefix, updatePrefix } from "./actions";

export type PrefixRow = {
  id: number;
  name: string;
  cidr: string;
  ignore: boolean;
  bpsMbps: number | null;
  pps: number | null;
  synPps: number | null;
};

type FormState = {
  id?: number;
  name: string;
  cidr: string;
  ignore: boolean;
  bpsMbps: string;
  pps: string;
  synPps: string;
};

const emptyForm: FormState = {
  name: "",
  cidr: "",
  ignore: false,
  bpsMbps: "",
  pps: "",
  synPps: "",
};

/** campo vazio = limite global (null) */
const opt = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

function limitsText(p: PrefixRow) {
  const parts: string[] = [];
  if (p.bpsMbps !== null) parts.push(`${formatNumber(p.bpsMbps)} Mbps`);
  if (p.pps !== null) parts.push(`${formatNumber(p.pps)} pps`);
  if (p.synPps !== null) parts.push(`${formatNumber(p.synPps)} SYN/s`);
  return parts.length ? parts.join(" · ") : "Limites globais";
}

export function PrefixesManager({ prefixes }: { prefixes: PrefixRow[] }) {
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PrefixRow | null>(null);
  const [pending, startTransition] = useTransition();

  const isEditing = form?.id !== undefined;

  function openCreate() {
    setFormError(null);
    setForm({ ...emptyForm });
  }

  function openEdit(p: PrefixRow) {
    setFormError(null);
    setForm({
      id: p.id,
      name: p.name,
      cidr: p.cidr,
      ignore: p.ignore,
      bpsMbps: p.bpsMbps === null ? "" : String(p.bpsMbps),
      pps: p.pps === null ? "" : String(p.pps),
      synPps: p.synPps === null ? "" : String(p.synPps),
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError(null);

    const payload = {
      id: form.id,
      name: form.name,
      cidr: form.cidr,
      ignore: form.ignore,
      bpsMbps: opt(form.bpsMbps),
      pps: opt(form.pps),
      synPps: opt(form.synPps),
    };
    for (const v of [payload.bpsMbps, payload.pps, payload.synPps]) {
      if (v !== null && Number.isNaN(v)) {
        setFormError("Limites devem ser números (ou deixe vazio para usar o global)");
        return;
      }
    }

    startTransition(async () => {
      const res = isEditing ? await updatePrefix(payload) : await createPrefix(payload);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(isEditing ? "Prefixo atualizado" : "Prefixo cadastrado");
      setForm(null);
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    startTransition(async () => {
      const res = await deletePrefix(target.id);
      if (res.ok) toast.success(`Prefixo ${target.cidr} removido`);
      else toast.error(res.error);
      setToDelete(null);
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Network className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Prefixos</h1>
            <p className="text-sm text-muted-foreground">
              Redes dos clientes com limites próprios, ou na lista de exceção (nunca geram alerta).
            </p>
          </div>
        </div>
        <Button size="lg" onClick={openCreate}>
          <Plus />
          Novo prefixo
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Prefixo</TableHead>
              <TableHead>Regra</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prefixes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Nenhum prefixo cadastrado: valem os limites globais para todos os destinos.
                </TableCell>
              </TableRow>
            )}
            {prefixes.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono">{p.cidr}</TableCell>
                <TableCell>
                  {p.ignore ? (
                    <Badge className="bg-muted text-muted-foreground">Exceção (ignorar)</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">{limitsText(p)}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${p.name}`}
                      onClick={() => openEdit(p)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${p.name}`}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setToDelete(p)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Vale o prefixo mais específico (maior máscara). Ex.: um /32 de exceção dentro de um /24 monitorado.
      </p>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar prefixo" : "Novo prefixo"}</DialogTitle>
            <DialogDescription>
              Campos de limite vazios usam o limite global da página Detecção.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-name">Nome</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Cliente corporativo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cidr">Prefixo IPv4</Label>
                <Input
                  id="p-cidr"
                  value={form.cidr}
                  onChange={(e) => setForm({ ...form, cidr: e.target.value })}
                  placeholder="203.0.113.0/24 ou 203.0.113.10"
                  className="font-mono"
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ignore}
                  onChange={(e) => setForm({ ...form, ignore: e.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                Lista de exceção: nunca alertar para este prefixo
              </label>

              <div className={`grid grid-cols-3 gap-3 ${form.ignore ? "opacity-50" : ""}`}>
                <div className="space-y-2">
                  <Label htmlFor="p-bps">Mbps</Label>
                  <Input
                    id="p-bps"
                    inputMode="decimal"
                    value={form.bpsMbps}
                    onChange={(e) => setForm({ ...form, bpsMbps: e.target.value })}
                    disabled={form.ignore}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-pps">Pacotes/s</Label>
                  <Input
                    id="p-pps"
                    inputMode="numeric"
                    value={form.pps}
                    onChange={(e) => setForm({ ...form, pps: e.target.value })}
                    disabled={form.ignore}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-syn">SYN/s</Label>
                  <Input
                    id="p-syn"
                    inputMode="numeric"
                    value={form.synPps}
                    onChange={(e) => setForm({ ...form, synPps: e.target.value })}
                    disabled={form.ignore}
                  />
                </div>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {formError}
                </p>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  {isEditing ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover prefixo?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && (
                <>
                  <strong>{toDelete.name}</strong> ({toDelete.cidr}) voltará a seguir os limites
                  globais.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={pending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {pending && <Loader2 className="animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
