import { AppHeader } from "@/components/app-header";
import { requireAccess } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { ADMIN_NAV } from "@/lib/nav";
import { getThemeColor } from "@/lib/settings";
import { ThemeColorForm } from "./theme-color-form";
import { UsersManager, type UserRow } from "./users-manager";

export const metadata = { title: "Administração · SOSISP" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireAccess("/admin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  const themeColor = await getThemeColor();

  const rows: UserRow[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-white">
      <AppHeader user={me} section="Administração" nav={ADMIN_NAV} current="/admin" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ThemeColorForm current={themeColor} />
        <UsersManager users={rows} currentUserId={me.id} />
      </main>
    </div>
  );
}
