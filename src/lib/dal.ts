import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { decrypt, SESSION_COOKIE } from "./session";
import { canAccess, ROLE_HOME, type RoleName } from "./roles";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: RoleName;
};

/**
 * Usuário logado, relido do banco a cada request: se o usuário foi
 * excluído, desativado ou teve o nível alterado, o cookie antigo deixa
 * de valer imediatamente.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await decrypt(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** Exige login e que o nível do usuário permita acessar `pathname`. */
export async function requireAccess(pathname: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canAccess(user.role, pathname)) redirect(ROLE_HOME[user.role]);
  return user;
}

/** Para Server Actions: exige um dos níveis informados ou lança erro. */
export async function requireRole(...roles: RoleName[]) {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) {
    throw new Error("Não autorizado");
  }
  return user;
}
