import { LogOut, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/login/actions";
import { ROLE_LABEL, type RoleName } from "@/lib/roles";

export function AppHeader({
  user,
  section,
}: {
  user: { name: string; email: string; role: RoleName };
  section: string;
}) {
  return (
    <header className="bg-primary text-primary-foreground shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <ShieldCheck className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="font-semibold">SOSISP</p>
            <p className="text-xs text-white/75">{section}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-white/75">{user.email}</p>
          </div>
          <Badge className="bg-white text-primary hover:bg-white">
            {ROLE_LABEL[user.role]}
          </Badge>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/15 hover:text-white"
            >
              <LogOut />
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
