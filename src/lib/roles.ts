export type RoleName = "ADMIN" | "USER" | "GUEST";

export const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: "Administrador",
  USER: "Usuário",
  GUEST: "Convidado",
};

/** Página inicial de cada nível de acesso. */
export const ROLE_HOME: Record<RoleName, string> = {
  ADMIN: "/admin",
  USER: "/sistema",
  GUEST: "/sistema",
};

/** Prefixos de rota que cada nível pode acessar. */
export const ROLE_ALLOWED: Record<RoleName, string[]> = {
  ADMIN: ["/admin"],
  USER: ["/sistema"],
  GUEST: ["/sistema"],
};

export function canAccess(role: RoleName, pathname: string) {
  return ROLE_ALLOWED[role].some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}
