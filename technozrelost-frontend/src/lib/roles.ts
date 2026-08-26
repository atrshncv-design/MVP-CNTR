export const ROLES = [
  { slug: "gk_customer", name: "ГосКомпания-заказчик", order: 1 },
  { slug: "rd_executor", name: "R&D-исполнитель", order: 2 },
  { slug: "scientific_org", name: "Научная организация", order: 3 },
  { slug: "serial_manufacturer", name: "Серийный производитель", order: 4 },
  { slug: "regulating_organization", name: "Регулирующая организация", order: 5 },
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
  regulating_organization: "/dashboard/regulating_organization",
  auditor: "/dashboard/auditor",
  investor: "/dashboard/investor",
  cntr_admin: "/dashboard/cntr_admin",
  cntr_manager: "/dashboard/cntr_manager",
};

// Роли, которым открыт любой общий раздел кабинета (реестры, профиль,
// карточки проектов): матрица fail-closed, поэтому «все роли» пишем явно —
// отсутствие записи означает запрет (FE-01).
const ALL_ROLES: RoleSlug[] = [
  "gk_customer",
  "rd_executor",
  "scientific_org",
  "serial_manufacturer",
  "regulating_organization",
  "auditor",
  "investor",
  "cntr_admin",
  "cntr_manager",
];

// Какая роль вправе видеть какой кабинет. Порядок записей важен:
// более специфичные маршруты объявляются раньше общих префиксов —
// allowedRolesFor берёт ПЕРВОЕ совпадение (см. компиляцию ниже).
export const ROUTE_ALLOWED_ROLES: Record<string, RoleSlug[]> = {
  // Индекс /dashboard — редиректор на кабинет primary-роли: доступен всем.
  "/dashboard": ALL_ROLES,
  // Универсальный опросник УГТ: доступен любой роли (решение №3 интервью 03.08)
  "/dashboard/gk_customer/projects/new": [
    "gk_customer",
    "rd_executor",
    "scientific_org",
    "serial_manufacturer",
    "regulating_organization",
    "auditor",
    "investor",
    "cntr_admin",
    "cntr_manager",
  ],
  "/dashboard/projects": [
    "gk_customer",
    "rd_executor",
    "scientific_org",
    "serial_manufacturer",
    "regulating_organization",
    "auditor",
    "investor",
    "cntr_admin",
    "cntr_manager",
  ],
  "/dashboard/gk_customer": ["gk_customer"],
  "/dashboard/rd_executor": ["rd_executor"],
  "/dashboard/scientific_org": ["scientific_org"],
  "/dashboard/serial_manufacturer": ["serial_manufacturer"],
  "/dashboard/regulating_organization": ["regulating_organization"],
  "/dashboard/auditor": ["auditor"],
  "/dashboard/investor": ["investor"],
  "/dashboard/cntr_admin": ["cntr_admin"],
  "/dashboard/cntr_manager": ["cntr_manager"],
  "/dashboard/project": [
    "gk_customer",
    "rd_executor",
    "scientific_org",
    "serial_manufacturer",
    "regulating_organization",
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
    "regulating_organization",
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
  // Новости (тикет 08): лента — все роли; консоль и редактор — только
  // сотрудники ЦНТР. Порядок важен: более специфичные маршруты идут раньше
  // "/dashboard/news" (allowedRolesFor берёт первое совпадение).
  "/dashboard/news/admin": ["cntr_admin", "cntr_manager"],
  "/dashboard/news/new": ["cntr_admin", "cntr_manager"],
  // Редактор существующей новости: [id] — динамический сегмент. Запись
  // обязана стоять ВЫШЕ "/dashboard/news", иначе редактор унаследует доступ
  // ленты для всех ролей (FE-01: дыра была найдена аудитом).
  "/dashboard/news/[id]/edit": ["cntr_admin", "cntr_manager"],
  "/dashboard/news": ALL_ROLES,
  // Реестр НИОКР и карточка по рег. номеру — общий раздел (FE-01).
  "/dashboard/nioktr": ALL_ROLES,
  // Реестр организаций и карточка по ОГРН — общий раздел (FE-01).
  "/dashboard/organizations": ALL_ROLES,
  // Профиль пользователя — общий раздел (FE-01).
  "/dashboard/profile": ALL_ROLES,
};

export function isProtectedRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard");
}

export function isAuthRoute(pathname: string): boolean {
  return ["/login", "/register"].includes(pathname);
}

/** Экранирование спецсимволов regex в статических частях ключа маршрута. */
function escapeRegExp(part: string): string {
  return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Ключи матрицы компилируются один раз при загрузке модуля: [param] —
// ровно один сегмент пути, поэтому middleware сверяет ИНСТАНЦИИРОВАННЫЕ
// пути (/dashboard/news/42/edit), а не литеральные "[id]". Сопоставление
// по границе сегмента (^…(/|$)) сохраняет прежнюю префиксную семантику.
// Корень /dashboard — исключение: он совпадает только точно, иначе
// префиксная запись поглотила бы ВСЕ вложенные маршруты и вернула бы
// им полный доступ вместо запрета по умолчанию (fail-closed сломался бы).
const EXACT_ONLY_ROUTES = new Set<string>(["/dashboard"]);

const COMPILED_ROUTES = Object.entries(ROUTE_ALLOWED_ROLES).map(
  ([key, roles]) => {
    const source = key
      .split(/\[[^\]]*\]/)
      .map(escapeRegExp)
      .join("[^/]+");
    const tail = EXACT_ONLY_ROUTES.has(key) ? "$" : "(/|$)";
    return { pattern: new RegExp(`^${source}${tail}`), roles };
  },
);

/**
 * Роли, разрешённые для маршрута, либо null — если записи нет.
 * null означает ЗАПРЕТ (fail-closed): вызывающий (middleware, меню)
 * обязан трактовать его как «доступ ни для кого».
 */
export function allowedRolesFor(pathname: string): RoleSlug[] | null {
  for (const { pattern, roles } of COMPILED_ROUTES) {
    if (pattern.test(pathname)) return roles;
  }
  return null;
}
