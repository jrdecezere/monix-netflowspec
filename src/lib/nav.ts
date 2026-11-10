export type NavItem = { href: string; label: string };

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Usuários" },
  { href: "/admin/deteccao", label: "Detecção" },
  { href: "/admin/prefixos", label: "Prefixos" },
  { href: "/admin/diagnostico", label: "Diagnóstico" },
];

export const SYSTEM_NAV: NavItem[] = [
  { href: "/sistema", label: "Tráfego" },
  { href: "/sistema/eventos", label: "Ataques" },
];
