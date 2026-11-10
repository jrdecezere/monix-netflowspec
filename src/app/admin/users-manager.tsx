"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABEL, type RoleName } from "@/lib/roles";
import { createUser, deleteUser, updateUser } from "./actions";

export type UserRow = {
  id: number;
  name: string;
  email: string;
  role: RoleName;
  active: boolean;
  createdAt: string;
};

type FormState = {
  id?: number;
  name: string;
  email: string;
  password: string;
  role: RoleName;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  role: "GUEST",
  active: true,
};

const roleItems = (Object.keys(ROLE_LABEL) as RoleName[]).map((value) => ({
  value,
  label: ROLE_LABEL[value],
}));

const roleBadge: Record<RoleName, string> = {
  ADMIN: "bg-primary text-primary-foreground",
  USER: "bg-secondary text-secondary-foreground",
  GUEST: "bg-muted text-muted-foreground",
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: number;
}) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<UserRow | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      ROLE_LABEL[u.role].toLowerCase().includes(q)
    );
  });

  const isEditing = form?.id !== undefined;
  const isSelf = form?.id === currentUserId;

  function openCreate() {
    setFormError(null);
    setForm({ ...emptyForm });
  }

  function openEdit(u: UserRow) {
    setFormError(null);
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      active: u.active,
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError(null);

    startTransition(async () => {
      const result = isEditing ? await updateUser(form) : await createUser(form);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success(isEditing ? "Usuário atualizado" : "Usuário criado");
      setForm(null);
    });
  }

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    startTransition(async () => {
      const result = await deleteUser(target.id);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(`Usuário "${target.name}" excluído`);
      }
      setToDelete(null);
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Usuários</h1>
            <p className="text-sm text-muted-foreground">
              {users.length} {users.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}
            </p>
          </div>
        </div>
        <Button size="lg" onClick={openCreate}>
          <Plus />
          Novo usuário
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, e-mail ou nível"
          className="pl-8"
          aria-label="Buscar usuários"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader className="bg-secondary/60">
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge className={roleBadge[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      u.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-border text-muted-foreground"
                    }
                  >
                    {u.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${u.name}`}
                      onClick={() => openEdit(u)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${u.name}`}
                      disabled={u.id === currentUserId}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setToDelete(u)}
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

      {/* Criar / editar */}
      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Altere os dados abaixo. Deixe a senha em branco para mantê-la."
                : "Preencha os dados para criar o acesso."}
            </DialogDescription>
          </DialogHeader>

          {form && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="u-name">Nome</Label>
                <Input
                  id="u-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-email">E-mail</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-password">
                  {isEditing ? "Nova senha (opcional)" : "Senha"}
                </Label>
                <Input
                  id="u-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo de 8 caracteres"
                  required={!isEditing}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nível de acesso</Label>
                  <Select
                    items={roleItems}
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v as RoleName })}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {roleItems.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    items={[
                      { value: "true", label: "Ativo" },
                      { value: "false", label: "Inativo" },
                    ]}
                    value={String(form.active)}
                    onValueChange={(v) => setForm({ ...form, active: v === "true" })}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="true">Ativo</SelectItem>
                      <SelectItem value="false">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Administrador acessa só <code>/admin</code>; Usuário e Convidado
                acessam <code>/sistema</code> (Convidado somente leitura).
              </p>

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
                  {isEditing ? "Salvar" : "Criar usuário"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && (
                <>
                  <strong>{toDelete.name}</strong> ({toDelete.email}) perderá o
                  acesso imediatamente. Esta ação não pode ser desfeita.
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
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
