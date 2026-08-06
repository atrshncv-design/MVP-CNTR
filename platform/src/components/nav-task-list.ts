/**
 * T-002. Данные задача-first навигации публичной части (Design.md §4.1).
 * Навигация строится вокруг задач посетителя, а не внутренних разделов:
 * «найти решение», «представить технологию», «найти партнёра» и т.д.
 * Маршруты — из ROUTES.md; страницы discovery/регистрации появятся
 * в тикетах T-006/T-013, сейчас ссылки ведут на будущие маршруты.
 */

export type TaskNavItem = {
  /** Короткий заголовок задачи в навигации */
  label: string;
  href: string;
  /** Пояснение — показывается в мобильном меню и для aria-label */
  description: string;
};

export const PUBLIC_TASK_NAV: TaskNavItem[] = [
  {
    label: "Найти решение",
    href: "/find",
    description: "Технологии, исполнители, запросы и меры поддержки",
  },
  {
    label: "Представить технологию",
    href: "/register",
    description: "Создать досье технологии и начать путь готовности",
  },
  {
    label: "Найти партнёра",
    href: "/partners",
    description: "Организации, исполнители и производственные возможности",
  },
  {
    label: "Найти поддержку",
    href: "/support",
    description: "Меры поддержки, конкурсы, пилоты и события",
  },
  {
    label: "Исследования и НИОКТР",
    href: "/research",
    description: "Реестр научно-исследовательских и опытно-конструкторских работ",
  },
  {
    label: "О Центре",
    href: "/about",
    description: "Миссия, методология и команда Центра",
  },
];

/** Совпадает ли текущий путь с разделом (префиксно, кроме корня) */
export function isTaskActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type FooterLink = {
  label: string;
  href: string;
};

export type FooterColumn = {
  title: string;
  links: FooterLink[];
};

/**
 * Служебные ссылки футера. Вторичная навигация (§4.1): реестры,
 * поддержка/конкурсы/пилоты, методология и УГТ, сведения о Центре.
 */
export const PUBLIC_FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Платформа",
    links: [
      { label: "Найти решение", href: "/find" },
      { label: "Реестр технологий", href: "/technologies" },
      { label: "Исследования и НИОКТР", href: "/research" },
      { label: "Карта экосистемы", href: "/map" },
    ],
  },
  {
    title: "Поддержка",
    links: [
      { label: "Меры поддержки", href: "/support" },
      { label: "Конкурсы и отборы", href: "/competitions" },
      { label: "Пилоты и внедрение", href: "/pilots" },
      { label: "Инвестэкспертиза", href: "/investments" },
    ],
  },
  {
    title: "Реестры",
    links: [
      { label: "Запросы заказчиков", href: "/requests" },
      { label: "Организации и исполнители", href: "/partners" },
      { label: "Заказчикам", href: "/customers" },
      { label: "Исполнителям", href: "/performers" },
    ],
  },
  {
    title: "Центр",
    links: [
      { label: "О Центре", href: "/about" },
      { label: "Методология готовности", href: "/methodology" },
      { label: "Уровни готовности УГТ", href: "/levels" },
      { label: "Дорожная карта", href: "/roadmap" },
    ],
  },
];
