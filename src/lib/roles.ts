export const ROLES = [
  { slug: "gk_customer", name: "ГосКомпания-заказчик", order: 1 },
  { slug: "rd_executor", name: "R&D-исполнитель", order: 2 },
  { slug: "scientific_org", name: "Научная организация", order: 3 },
  { slug: "serial_manufacturer", name: "Серийный производитель", order: 4 },
  { slug: "ugt_expert", name: "Эксперт УГТ", order: 5 },
  { slug: "auditor", name: "Аудитор", order: 6 },
  { slug: "investor", name: "Инвестор", order: 7 },
  { slug: "cntr_admin", name: "Администратор ЦНТР", order: 8 },
  { slug: "cntr_manager", name: "Менеджер ЦНТР", order: 9 },
] as const;

export type RoleSlug = (typeof ROLES)[number]["slug"];

// Маршрут кабинета каждой роли (под /dashboard/...).
export const ROLE_DASHBOARD: Record<RoleSlug, string> = {
  gk_customer: "/dashboard/gk_customer",
  rd_executor: "/dashboard/rd_executor",
  scientific_org: "/dashboard/scientific_org",
  serial_manufacturer: "/dashboard/serial_manufacturer",
  ugt_expert: "/dashboard/ugt_expert",
  auditor: "/dashboard/auditor",
  investor: "/dashboard/investor",
  cntr_admin: "/dashboard/cntr_admin",
  cntr_manager: "/dashboard/cntr_manager",
};

// Какая роль вправе видеть какой кабинет.
export const ROUTE_ALLOWED_ROLES: Record<string, RoleSlug[]> = {
  "/dashboard/gk_customer": ["gk_customer"],
  "/dashboard/rd_executor": ["rd_executor"],
  "/dashboard/scientific_org": ["scientific_org"],
  "/dashboard/serial_manufacturer": ["serial_manufacturer"],
  "/dashboard/ugt_expert": ["ugt_expert"],
  "/dashboard/auditor": ["auditor"],
  "/dashboard/investor": ["investor"],
  "/dashboard/cntr_admin": ["cntr_admin"],
  "/dashboard/cntr_manager": ["cntr_manager"],
  "/dashboard/project": [
    "gk_customer",
    "rd_executor",
    "scientific_org",
    "serial_manufacturer",
    "ugt_expert",
    "auditor",
    "investor",
    "cntr_admin",
    "cntr_manager",
  ],
  "/dashboard/executors": [
    "gk_customer",
    "rd_executor",
    "scientific_org",
    "serial_manufacturer",
    "cntr_admin",
    "cntr_manager",
  ],
  "/dashboard/technologies": [
    "gk_customer",
    "rd_executor",
    "scientific_org",
    "serial_manufacturer",
    "ugt_expert",
    "auditor",
    "investor",
    "cntr_admin",
    "cntr_manager",
  ],
  "/dashboard/ai-assistant": [
    "gk_customer",
    "rd_executor",
    "scientific_org",
    "serial_manufacturer",
    "cntr_admin",
    "cntr_manager",
  ],
};

export function isProtectedRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard");
}

export function isAuthRoute(pathname: string): boolean {
  return ["/login", "/register"].includes(pathname);
}

export function allowedRolesFor(pathname: string): RoleSlug[] | null {
  for (const [prefix, roles] of Object.entries(ROUTE_ALLOWED_ROLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return roles;
  }
  return null;
}