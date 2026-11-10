"use client";

import { useState, useTransition } from "react";
import { Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_THEME_COLOR,
  THEME_PRESETS,
  isHexColor,
  readableForeground,
} from "@/lib/theme";
import { updateThemeColor } from "./actions";

export function ThemeColorForm({ current }: { current: string }) {
  const [color, setColor] = useState(current);
  const [pending, startTransition] = useTransition();

  const valid = isHexColor(color);
  const dirty = valid && color.toLowerCase() !== current.toLowerCase();

  function save() {
    startTransition(async () => {
      const res = await updateThemeColor(color);
      if (res.ok) toast.success("Cor do layout atualizada");
      else toast.error(res.error);
    });
  }

  return (
    <section className="mb-8 rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Palette className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold leading-tight">Cor do layout</h2>
          <p className="text-sm text-muted-foreground">
            Define a cor principal do sistema para todos os usuários.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="theme-color-picker">Cor</Label>
          <div className="flex items-center gap-2">
            <input
              id="theme-color-picker"
              type="color"
              value={valid ? color : DEFAULT_THEME_COLOR}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-md border border-input bg-white p-1"
              aria-label="Escolher cor"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value.trim())}
              maxLength={7}
              placeholder="#474787"
              aria-invalid={!valid}
              className="w-28 font-mono uppercase"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Sugestões</Label>
          <div className="flex gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.label}
                aria-label={p.label}
                onClick={() => setColor(p.value)}
                className="size-9 rounded-full border-2 border-white shadow ring-1 ring-border transition hover:scale-110 data-[active=true]:ring-2 data-[active=true]:ring-foreground"
                data-active={color.toLowerCase() === p.value}
                style={{ backgroundColor: p.value }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Pré-visualização</Label>
          <div
            className="flex h-9 items-center rounded-md px-3 text-sm font-medium"
            style={
              valid
                ? { backgroundColor: color, color: readableForeground(color) }
                : undefined
            }
          >
            SOSISP
          </div>
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending || color.toLowerCase() === DEFAULT_THEME_COLOR}
            onClick={() => setColor(DEFAULT_THEME_COLOR)}
          >
            Restaurar padrão
          </Button>
          <Button type="button" disabled={pending || !dirty} onClick={save}>
            {pending && <Loader2 className="animate-spin" />}
            Salvar cor
          </Button>
        </div>
      </div>

      {!valid && (
        <p className="mt-2 text-sm text-destructive">
          Use o formato #RRGGBB (ex.: #474787).
        </p>
      )}
    </section>
  );
}
