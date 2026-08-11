import { ROUTE_ALLOWED_ROLES, ROLE_DASHBOARD, type RoleSlug } from "./roles";

/**
 * Карта «роль → пункты меню» единого dashboard shell.
 *
 * Пункты строятся ТОЛЬКО из реальных маршрутов приложения (см. src/app/dashboard/*)
 * и разрешений ролей (ROUTE_ALLOWED_ROLES + middleware). Это чисто видимость UI:
 * скрытие пункта НЕ заменяет backend authorization — проверки прав выполняются
 * middleware (`src/middleware.ts`) и на backend, независимо от этой карты.
 */

export interface NavItem {
  /** Реальный маршрут приложения (страница обязана существовать). */
  href: string;
  label: string;
  /**
   * true — aria-current="page" только при точном совпадении pathname;
   * false (по умолчанию) — также при совпадении префикса (вложенные страницы).
   */
  exact?: boolean;
  /** Единообразная пометка раздела «в разработке» (рендерится в nav.tsx). */
  badge?: string;
  /** Группа пункта: основная навигация / ролевой кабинет / аккаунт. */
  group: "main" | "role" | "account";
}

/**
 * Общие пункты: доступны любой авторизованной роли.
 * Маршруты либо не ограничены в ROUTE_ALLOWED_ROLES (middleware пропускает
 * любого залогиненного), либо разрешены всем девяти ролям.
 *
 * Разделы «В разработке» (тикет 06, operations-modules) помечаются badge
 * единообразно; их страницы — честный статус через компонент ComingSoon
 * (src/components/coming-soon.tsx), без интерактивных элементов и мок-данных.
 * «Образовательный модуль» сознательно ОТСУТСТВУЕТ в навигации и маршрутах.
 */
export const COMMON_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Рабочий стол", exact: true, group: "main" },
  { href: "/dashboard/projects", label: "Проекты", group: "main" },
  { href: "/dashboard/gk_customer/projects/new", label: "Заявки", group: "main" },
  { href: "/dashboard/technologies", label: "Реестры", group: "main" },
  { href: "/dashboard/nioktr", label: "НИОКТР", group: "main" },
  { href: "/dashboard/organizations", label: "Организации", group: "main" },
  { href: "/dashboard/news", label: "Новости и мероприятия", badge: "В разработке", group: "main" },
  { href: "/dashboard/profile", label: "Профиль", exact: true, group: "account" },
];

/**
 * Ролевые пункты: только маршруты, которые роль вправе открыть.
 * «Исполнители» (/dashboard/executors) и «Документы» (/dashboard/ai-assistant)
 * разрешены шести ролям из ROUTE_ALLOWED_ROLES; аудитору, инвестору и
 * регулирующей организации они недоступны — в их меню их нет.
 */
export const ROLE_NAV_ITEMS: Record<RoleSlug, NavItem[]> = {
  gk_customer: [
    { href: ROLE_DASHBOARD.gk_customer, label: "Мой кабинет", exact: true, group: "role" },
    { href: "/dashboard/executors", label: "Исполнители", group: "role" },
    { href: "/dashboard/ai-assistant", label: "Документы", group: "role" },
  ],
  rd_executor: [
    { href: ROLE_DASHBOARD.rd_executor, label: "Мой кабинет", exact: true, group: "role" },
    { href: "/dashboard/executors", label: "Исполнители", group: "role" },
    { href: "/dashboard/ai-assistant", label: "Документы", group: "role" },
  ],
  scientific_org: [
    { href: ROLE_DASHBOARD.scientific_org, label: "Мой кабинет", exact: true, group: "role" },
    { href: "/dashboard/executors", label: "Исполнители", group: "role" },
    { href: "/dashboard/ai-assistant", label: "Документы", group: "role" },
  ],
  serial_manufacturer: [
    { href: ROLE_DASHBOARD.serial_manufacturer, label: "Мой кабинет", exact: true, group: "role" },
    { href: "/dashboard/executors", label: "Исполнители", group: "role" },
    { href: "/dashboard/ai-assistant", label: "Документы", group: "role" },
  ],
  cntr_admin: [
    { href: ROLE_DASHBOARD.cntr_admin, label: "Мой кабинет", exact: true, group: "role" },
    { href: "/dashboard/executors", label: "Исполнители", group: "role" },
    { href: "/dashboard/ai-assistant", label: "Документы", group: "role" },
    { href: "/dashboard/forecasting", label: "Сценарное прогнозирование", badge: "В разработке", group: "role" },
    { href: "/dashboard/effectiveness", label: "Эффективность мероприятий", badge: "В разработке", group: "role" },
  ],
  cntr_manager: [
    { href: ROLE_DASHBOARD.cntr_manager, label: "Мой кабинет", exact: true, group: "role" },
    { href: "/dashboard/executors", label: "Исполнители", group: "role" },
    { href: "/dashboard/ai-assistant", label: "Документы", group: "role" },
    { href: "/dashboard/forecasting", label: "Сценарное прогнозирование", badge: "В разработке", group: "role" },
    { href: "/dashboard/effectiveness", label: "Эффективность мероприятий", badge: "В разработке", group: "role" },
  ],
  regulating_organization: [
    { href: ROLE_DASHBOARD.regulating_organization, label: "Мой кабинет", exact: true, group: "role" },
  ],
  auditor: [
    { href: ROLE_DASHBOARD.auditor, label: "Мой кабинет", exact: true, group: "role" },
  ],
  investor: [
    { href: ROLE_DASHBOARD.investor, label: "Мой кабинет", exact: true, group: "role" },
  ],
};

/** Все маршруты, встречающиеся в навигации (для тестов и аудита). */
export const ALL_NAV_ROUTES: string[] = [
  ...COMMON_NAV_ITEMS.map((i) => i.href),
  ...Object.values(ROLE_NAV_ITEMS).flatMap((items) => items.map((i) => i.href)),
];

/**
 * Пункты меню для набора ролей пользователя (session.user.roles).
 * Общие пункты + ролевые пункты каждой из ролей (без дубликатов).
 * Порядок: общие → ролевые в порядке списка ролей.
 */
export function navItemsForRoles(roles: string[]): NavItem[] {
  const items: NavItem[] = [...COMMON_NAV_ITEMS];
  const seen = new Set(items.map((i) => i.href));
  for (const role of roles) {
    for (const item of ROLE_NAV_ITEMS[role as RoleSlug] ?? []) {
      if (!seen.has(item.href)) {
        items.push(item);
        seen.add(item.href);
      }
    }
  }
  return items;
}

/**
 * Проверка «нет чужих маршрутов»: разрешён ли пункт меню конкретной роли.
 * Если маршрут есть в ROUTE_ALLOWED_ROLES — роль обязана быть в списке;
 * иначе маршрут не ограничен middleware и доступен любой авторизованной роли.
 */
export function isRouteAllowedForRole(href: string, role: RoleSlug): boolean {
  const allowed = ROUTE_ALLOWED_ROLES[href];
  if (allowed) return allowed.includes(role);
  // Маршрут не ограничен: middleware пропускает любую авторизованную роль.
  return true;
}

/**
 * Активен ли пункт меню на текущем пути.
 * exact — только точное совпадение; иначе также совпадение префикса.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
