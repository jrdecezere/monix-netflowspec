"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Recarrega os dados do servidor periodicamente (sem recarregar a página). */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    const stamp = () =>
      setUpdatedAt(new Date().toLocaleTimeString("pt-BR"));
    stamp();
    if (paused) return;
    const id = setInterval(() => {
      router.refresh();
      stamp();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [paused, router, seconds]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <RefreshCw className={`size-3.5 ${paused ? "" : "animate-[spin_3s_linear_infinite]"}`} />
      <span>
        {paused ? "Pausado" : `Atualiza a cada ${seconds}s`}
        {updatedAt && ` · ${updatedAt}`}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={paused ? "Retomar atualização" : "Pausar atualização"}
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? <Play /> : <Pause />}
      </Button>
    </div>
  );
}
