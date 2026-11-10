import { AppHeader } from "@/components/app-header";
import { requireAccess } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { ADMIN_NAV } from "@/lib/nav";
import { PrefixesManager, type PrefixRow } from "./prefixes-manager";

export const metadata = { title: "Prefixos · SOSISP" };
export const dynamic = "force-dynamic";

export default async function PrefixesPage() {
  const me = await requireAccess("/admin");
  const list = await prisma.prefix.findMany({ orderBy: { name: "asc" } });

  const rows: PrefixRow[] = list.map((p) => ({
    id: p.id,
    name: p.name,
    cidr: p.cidr,
    ignore: p.ignore,
    bpsMbps: p.bpsLimit === null ? null : p.bpsLimit / 1e6,
    pps: p.ppsLimit,
    synPps: p.synPpsLimit,
  }));

  return (
    <div className="min-h-screen bg-white">
      <AppHeader user={me} section="Administração" nav={ADMIN_NAV} current="/admin/prefixos" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <PrefixesManager prefixes={rows} />
      </main>
    </div>
  );
}
