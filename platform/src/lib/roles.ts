/**
 * T-003. Ролевая модель и приоритеты навигации (зеркало бэкенда, ROLES.md).
 *
 * Роли бэкенда: gk_customer, rd_executor, scientific_org, serial_manufacturer,
 * regulating_organization, auditor, investor, cntr_admin, cntr_manager.
 * Каждая роль имеет СВОЙ порядок (приоритет) ролевых разделов — навигация
 * строится вокруг задач роли (Design.md §4.2), а не плоского списка.
 *
 * Реестр разделов — единственное место, где объявляется пункт навигации:
 * модуль добавляется одной записью (масштабирование без переделки каркаса).
 * Файл — чистые данные и хелперы, без JSX; используется клиентскими
 * компонентами шелла и страницей Workspace.
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Bookmark,
  Building2,
  ClipboardCheck,
  Database,
  Factory,
  FileText,
  FileUp,
  FlaskConical,
  FolderKanban,
  Gavel,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ListOrdered,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Wrench,
} from "lucide-react";
import type { Role } from "./types.ts";

/* ------------------------------------------------------------------ */
/* Роли бэкенда                                                         */
/* ------------------------------------------------------------------ */

/** Идентификаторы ролей бэкенда (зеркало; демо-аккаунты из спеки §2). */
export type BackendRoleId =
  | "gk_customer"
  | "rd_executor"
  | "scientific_org"
  | "serial_manufacturer"
  | "regulating_organization"
  | "auditor"
  | "investor"
  | "cntr_admin"
  | "cntr_manager";

/** Тип-гард: строка является известным идентификатором роли бэкенда. */
export function isBackendRoleId(value: unknown): value is BackendRoleId {
  return (
    typeof value === "string" &&
    BACKEND_ROLES.some((role) => role.id === value)
  );
}

/** Роли Центра — владельцы операционного шелла /(operations). */
export function isCenterRole(id: BackendRoleId): boolean {
  return id === "cntr_admin" || id === "cntr_manager";
}

export interface RoleDefinition {
  id: BackendRoleId;
  /** Внутренняя роль платформы (types.ts, доменная модель). */
  appRole: Role;
  /** Короткая подпись роли (свитчер, логин, шапка). */
  label: string;
  /** Задача роли (ROLES.md «Main job») — для свитчера и страницы входа. */
  description: string;
  /** Демо-аккаунт (mock-сессия P0; полноценный auth — T-013). */
  demoEmail: string;
  /** Стартовый маршрут кабинета (ROUTES.md; центр — операционный шелл). */
  home: string;
  /** Подпись общего раздела «Мои проекты / назначено мне» для роли. */
  myWorkLabel: string;
  /** Приоритет ролевых разделов: порядок в массиве = приоритет. */
  sections: readonly SectionId[];
}

/** Демо-аккаунты из спеки §2; для остальных ролей — производные example.com. */
const demoEmail = (slug: string): string => `demo.${slug}@example.com`;

export const BACKEND_ROLES: readonly RoleDefinition[] = [
  {
    id: "gk_customer",
    appRole: "customer",
    label: "Заказчик",
    description: "Находит решение, создаёт потребность, сравнивает и запускает пилот",
    demoEmail: "demo.gk@example.com",
    home: "/app",
    myWorkLabel: "Мои проекты",
    sections: [
      "customer-requests",
      "customer-search",
      "customer-pilots",
      "shortlists",
    ],
  },
  {
    id: "rd_executor",
    appRole: "partner",
    label: "Исполнитель",
    description: "Представляет технологию, доказывает готовность и продвигает её",
    demoEmail: "demo.rd@example.com",
    home: "/app",
    myWorkLabel: "Мои проекты",
    sections: [
      "partner-technologies",
      "applications",
      "partner-requests",
      "partner-pilots",
    ],
  },
  {
    id: "scientific_org",
    appRole: "science",
    label: "Научная организация",
    description: "Публикует исследования и связывает их с технологиями",
    demoEmail: demoEmail("science"),
    home: "/app",
    myWorkLabel: "Мои проекты",
    sections: ["science-research", "science-partners"],
  },
  {
    id: "serial_manufacturer",
    appRole: "manufacturer",
    label: "Серийный производитель",
    description: "Оценивает и внедряет технологии, готовые к производству",
    demoEmail: demoEmail("manufacturer"),
    home: "/app",
    myWorkLabel: "Мои проекты",
    sections: ["manufacturer-technologies", "manufacturer-pilots"],
  },
  {
    id: "regulating_organization",
    appRole: "regulator",
    label: "Регулирующая организация",
    description: "Проверяет соответствие и свидетельства по своей области",
    demoEmail: demoEmail("regulator"),
    home: "/app",
    myWorkLabel: "Мои проверки",
    sections: ["regulator-reviews", "regulator-history"],
  },
  {
    id: "auditor",
    appRole: "expert",
    label: "Эксперт / аудитор",
    description: "Проверяет свидетельства и рекомендует решение",
    demoEmail: demoEmail("auditor"),
    home: "/app",
    myWorkLabel: "Назначенные проверки",
    sections: ["expert-queue", "expert-history"],
  },
  {
    id: "investor",
    appRole: "investor",
    label: "Инвестор",
    description: "Изучает проверенные возможности и экспертизу",
    demoEmail: "demo.investor@example.com",
    home: "/app",
    myWorkLabel: "Мои проекты",
    sections: ["investor-technologies", "expertise", "watchlist"],
  },
  {
    id: "cntr_admin",
    appRole: "center_admin",
    label: "Администратор Центра",
    description: "Управляет доступом, ролями, настройками и качеством данных",
    demoEmail: "demo.admin@example.com",
    home: "/operations",
    myWorkLabel: "Моя работа",
    sections: [
      "ops-center",
      "ops-queue",
      "ops-registry",
      "ops-decisions",
      "ops-analytics",
    ],
  },
  {
    id: "cntr_manager",
    appRole: "center_manager",
    label: "Менеджер Центра",
    description: "Управляет очередями, проверками и решениями",
    demoEmail: "demo.manager@example.com",
    home: "/operations",
    myWorkLabel: "Моя работа",
    sections: [
      "ops-center",
      "ops-queue",
      "ops-registry",
      "ops-decisions",
      "ops-analytics",
    ],
  },
];

export function getRoleDefinition(
  id: BackendRoleId | null | undefined,
): RoleDefinition | null {
  if (!id) return null;
  return BACKEND_ROLES.find((role) => role.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/* Реестр разделов навигации                                            */
/* ------------------------------------------------------------------ */

export type SectionId =
  /* Общие разделы кабинета (Design.md §4.2 «Shared items») */
  | "workspace"
  | "my-work"
  | "notifications"
  | "documents"
  | "profile"
  /* Заказчик */
  | "customer-requests"
  | "customer-search"
  | "customer-pilots"
  | "shortlists"
  /* Исполнитель */
  | "partner-technologies"
  | "applications"
  | "partner-requests"
  | "partner-pilots"
  /* Научная организация */
  | "science-research"
  | "science-partners"
  /* Производитель */
  | "manufacturer-technologies"
  | "manufacturer-pilots"
  /* Регулирующая организация */
  | "regulator-reviews"
  | "regulator-history"
  /* Эксперт / аудитор */
  | "expert-queue"
  | "expert-history"
  /* Инвестор */
  | "investor-technologies"
  | "expertise"
  | "watchlist"
  /* Роли Центра в кабинете (переход в операционный шелл) */
  | "ops-center"
  | "ops-queue"
  | "ops-registry"
  | "ops-decisions"
  | "ops-analytics"
  /* Операционный центр /(operations) */
  | "ops-submissions"
  | "ops-verification"
  | "ops-requests"
  | "ops-organizations"
  | "ops-research"
  | "ops-pilots"
  | "ops-settings";

export interface SectionDef {
  id: SectionId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Пояснение (sr-only в сайдбаре, подпись в меню). */
  description?: string;
  group: "shared" | "role";
  /**
   * Кастомное правило подсветки. По умолчанию — точное совпадение или
   * префикс (href группы-корня — только точное, как у корня навигации).
   */
  match?: (pathname: string) => boolean;
  /** Точное совпадение (для корней групп: /app, /operations). */
  exact?: boolean;
};

/** Общие разделы кабинета — для всех авторизованных ролей. */
export const APP_SECTIONS: readonly SectionDef[] = [
  {
    id: "workspace",
    label: "Workspace",
    href: "/app",
    icon: LayoutDashboard,
    description: "Рабочее место и следующее действие",
    group: "shared",
    exact: true,
  },
  {
    id: "my-work",
    label: "Мои проекты",
    href: "/app/customer",
    icon: FolderKanban,
    description: "Проекты, заявки и назначенные задачи",
    group: "shared",
  },
  {
    id: "notifications",
    label: "Уведомления",
    href: "/app/notifications",
    icon: Bell,
    description: "События по проектам, заявкам и решениям",
    group: "shared",
  },
  {
    id: "documents",
    label: "Документы",
    href: "/app/documents",
    icon: FileText,
    description: "Документы организации и пользователя",
    group: "shared",
  },
  {
    id: "profile",
    label: "Профиль и организация",
    href: "/app/profile",
    icon: UserRound,
    description: "Профиль пользователя и карточка организации",
    group: "shared",
  },
  /* Заказчик */
  {
    id: "customer-requests",
    label: "Запросы",
    href: "/app/customer/requests",
    icon: Inbox,
    description: "Запросы заказчика: создание, сравнение, прогресс",
    group: "role",
  },
  {
    id: "customer-search",
    label: "Поиск решений",
    href: "/app/customer/search",
    icon: Search,
    description: "Проверенные технологии и исполнители по задаче",
    group: "role",
  },
  {
    id: "customer-pilots",
    label: "Пилоты",
    href: "/app/customer/pilots",
    icon: Rocket,
    description: "Пилотные проекты заказчика",
    group: "role",
  },
  {
    id: "shortlists",
    label: "Шорт-листы",
    href: "/app/customer/shortlists",
    icon: ListChecks,
    description: "Сохранённые сравнения технологий",
    group: "role",
  },
  /* Исполнитель */
  {
    id: "partner-technologies",
    label: "Технологии",
    href: "/app/partner/technologies",
    icon: FlaskConical,
    description: "Досье технологий организации и путь УГТ",
    group: "role",
  },
  {
    id: "applications",
    label: "Заявки",
    href: "/app/partner/applications",
    icon: FileUp,
    description: "Заявки на запросы заказчиков и пилоты",
    group: "role",
  },
  {
    id: "partner-requests",
    label: "Запросы заказчиков",
    href: "/app/partner/requests",
    icon: Inbox,
    description: "Открытые запросы, подходящие под технологии",
    group: "role",
  },
  {
    id: "partner-pilots",
    label: "Пилоты",
    href: "/app/partner/pilots",
    icon: Rocket,
    description: "Пилотные проекты исполнителя",
    group: "role",
  },
  /* Научная организация */
  {
    id: "science-research",
    label: "Исследования и НИОКТР",
    href: "/app/science/research",
    icon: FlaskConical,
    description: "Записи НИОКТР организации",
    group: "role",
  },
  {
    id: "science-partners",
    label: "Партнёры и запросы",
    href: "/app/science/partners",
    icon: Building2,
    description: "Организации и запросы по направлениям",
    group: "role",
  },
  /* Серийный производитель */
  {
    id: "manufacturer-technologies",
    label: "Технологии к внедрению",
    href: "/app/manufacturer/technologies",
    icon: Factory,
    description: "Проверенные технологии для производства",
    group: "role",
  },
  {
    id: "manufacturer-pilots",
    label: "Пилоты и внедрение",
    href: "/app/manufacturer/pilots",
    icon: Wrench,
    description: "Пилотные проекты с участием производителя",
    group: "role",
  },
  /* Регулирующая организация */
  {
    id: "regulator-reviews",
    label: "Проверки соответствия",
    href: "/app/regulator/reviews",
    icon: ShieldCheck,
    description: "Проверки по области регулирования",
    group: "role",
  },
  {
    id: "regulator-history",
    label: "История проверок",
    href: "/app/regulator/history",
    icon: History,
    description: "Завершённые проверки и решения",
    group: "role",
  },
  /* Эксперт / аудитор */
  {
    id: "expert-queue",
    label: "Очередь проверок",
    href: "/app/expert/queue",
    icon: ClipboardCheck,
    description: "Назначенные проверки свидетельств",
    group: "role",
  },
  {
    id: "expert-history",
    label: "История проверок",
    href: "/app/expert/history",
    icon: History,
    description: "Завершённые проверки и рекомендации",
    group: "role",
  },
  /* Инвестор */
  {
    id: "investor-technologies",
    label: "Проверенные технологии",
    href: "/app/investor/technologies",
    icon: TrendingUp,
    description: "Верифицированные возможности",
    group: "role",
  },
  {
    id: "expertise",
    label: "Экспертиза",
    href: "/app/investor/expertise",
    icon: ClipboardCheck,
    description: "Запросы экспертизы и их результаты",
    group: "role",
  },
  {
    id: "watchlist",
    label: "Отслеживаемое",
    href: "/app/investor/watchlist",
    icon: Bookmark,
    description: "Сохранённые возможности",
    group: "role",
  },
  /* Роли Центра в кабинете (ссылки в операционный шелл) */
  {
    id: "ops-center",
    label: "Операционный центр",
    href: "/operations",
    icon: LayoutDashboard,
    description: "Единый операционный контур Центра",
    group: "role",
    exact: true,
  },
  {
    id: "ops-queue",
    label: "Очередь",
    href: "/operations/queue",
    icon: ListOrdered,
    description: "Операционные задачи Центра",
    group: "role",
  },
  {
    id: "ops-registry",
    label: "Реестр технологий",
    href: "/operations/technology",
    icon: Database,
    description: "Управление реестром технологий",
    group: "role",
  },
  {
    id: "ops-decisions",
    label: "Решения и аудит",
    href: "/operations/decisions",
    icon: Gavel,
    description: "История решений и публикаций",
    group: "role",
  },
  {
    id: "ops-analytics",
    label: "Аналитика",
    href: "/operations/analytics",
    icon: BarChart3,
    description: "Данные и тренды экосистемы",
    group: "role",
  },
];

/* ------------------------------------------------------------------ */
/* Операционный шелл /(operations)                                      */
/* ------------------------------------------------------------------ */

/** Навигация операционного центра: очередь-first, плотная композиция. */
export const OPERATIONS_SECTIONS: readonly SectionDef[] = [
  {
    id: "ops-queue",
    label: "Очередь",
    href: "/operations/queue",
    icon: ListOrdered,
    description: "Операционные задачи по приоритету",
    group: "role",
    match: (pathname) =>
      pathname === "/operations" || pathname.startsWith("/operations/queue"),
  },
  {
    id: "ops-submissions",
    label: "Подачи",
    href: "/operations/submissions",
    icon: Inbox,
    description: "Технологии и запросы, поданные на проверку",
    group: "role",
  },
  {
    id: "ops-verification",
    label: "Проверка",
    href: "/operations/verification",
    icon: BadgeCheck,
    description: "Верификация полей и свидетельств",
    group: "role",
  },
  {
    id: "ops-registry",
    label: "Реестр технологий",
    href: "/operations/technology",
    icon: Database,
    description: "Реестр технологий Центра",
    group: "role",
  },
  {
    id: "ops-requests",
    label: "Запросы",
    href: "/operations/requests",
    icon: FileText,
    description: "Модерация запросов заказчиков",
    group: "role",
  },
  {
    id: "ops-organizations",
    label: "Организации",
    href: "/operations/organizations",
    icon: Building2,
    description: "Карточки организаций и их проверка",
    group: "role",
  },
  {
    id: "ops-research",
    label: "НИОКТР",
    href: "/operations/research",
    icon: FlaskConical,
    description: "Управление записями НИОКТР",
    group: "role",
  },
  {
    id: "ops-pilots",
    label: "Пилоты",
    href: "/operations/pilots",
    icon: Rocket,
    description: "Координация пилотных проектов",
    group: "role",
  },
  {
    id: "ops-decisions",
    label: "Решения",
    href: "/operations/decisions",
    icon: Gavel,
    description: "Решения и история публикаций",
    group: "role",
  },
  {
    id: "ops-analytics",
    label: "Аналитика",
    href: "/operations/analytics",
    icon: BarChart3,
    description: "Данные и тренды",
    group: "role",
  },
  {
    id: "ops-settings",
    label: "Настройки",
    href: "/operations/settings",
    icon: Settings,
    description: "Конфигурация операционного контура",
    group: "role",
  },
];

/** Группы операционной навигации (плотный каркас с заголовками). */
export const OPERATIONS_GROUPS: readonly {
  title: string;
  items: readonly SectionId[];
}[] = [
  { title: "Работа", items: ["ops-queue", "ops-submissions", "ops-verification"] },
  {
    title: "Реестры",
    items: [
      "ops-registry",
      "ops-requests",
      "ops-organizations",
      "ops-research",
      "ops-pilots",
    ],
  },
  { title: "Управление", items: ["ops-decisions", "ops-analytics", "ops-settings"] },
];

/* ------------------------------------------------------------------ */
/* Хелперы                                                              */
/* ------------------------------------------------------------------ */

/** Совпадает ли путь с разделом (точное/префиксное; корни — только точное). */
export function isSectionActive(
  pathname: string,
  section: SectionDef,
): boolean {
  if (section.match) return section.match(pathname);
  const { href } = section;
  if (href === "/" || section.exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Самый глубокий (конкретный) активный раздел — для подсветки и заголовка. */
export function findDeepestSection(
  pathname: string,
  sections: readonly SectionDef[],
): SectionDef | null {
  let best: SectionDef | null = null;
  for (const section of sections) {
    if (
      isSectionActive(pathname, section) &&
      (!best || section.href.length > best.href.length)
    ) {
      best = section;
    }
  }
  return best;
}

/** Человекочитаемые подписи сегментов URL за пределами раздела. */
const EXTRA_SEGMENT_LABELS: Record<string, string> = {
  new: "Создание записи",
  evidence: "Доказательства",
  path: "Путь УГТ",
  reviews: "Проверки",
  shortlists: "Шорт-листы",
};

function humanizeSegment(segment: string): string {
  const known = EXTRA_SEGMENT_LABELS[segment];
  if (known) return known;
  const words = segment.replace(/[-_]/g, " ").trim();
  if (!words) return segment;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Заголовок и хлебные крошки для контекстного top bar:
 * цепочка совпавших разделов (по вложенности) + сегменты пути за их пределами.
 */
export function sectionBreadcrumb(
  pathname: string,
  sections: readonly SectionDef[],
): { title: string; crumbs: string[] } {
  const matched = sections
    .filter((section) => isSectionActive(pathname, section))
    .sort((a, b) => a.href.length - b.href.length);
  const deepest = matched[matched.length - 1];
  if (!deepest) {
    return { title: "Кабинет", crumbs: ["Кабинет"] };
  }
  const crumbs = matched.map((section) => section.label);
  if (pathname.length > deepest.href.length) {
    const rest = pathname
      .slice(deepest.href.length)
      .split("/")
      .filter(Boolean);
    for (const segment of rest) crumbs.push(humanizeSegment(segment));
  }
  return { title: deepest.label, crumbs };
}

/* ------------------------------------------------------------------ */
/* Пустые состояния разделов (STATES.md §3 «Empty»)                     */
/* ------------------------------------------------------------------ */

export interface SectionEmptyState {
  title: string;
  description: string;
  /** Следующее действие (подпись + маршрут); по умолчанию — «Открыть раздел». */
  action?: { label: string; href: string };
}

/**
 * Честные пустые состояния для страницы Workspace по разделам.
 * Формулировки — по STATES.md §3 («У вашей организации пока нет запросов» и т.п.).
 */
export const SECTION_EMPTY_STATES: Partial<Record<SectionId, SectionEmptyState>> =
  {
    "customer-requests": {
      title: "У вашей организации пока нет запросов",
      description:
        "Создайте первый запрос — Центр поможет найти исполнителей и подходящие решения.",
      action: { label: "Создать запрос", href: "/app/customer/requests/new" },
    },
    "customer-search": {
      title: "Поиск решений ещё не выполнялся",
      description:
        "Найдите проверенные технологии и исполнителей по задаче вашей организации.",
      action: { label: "Открыть поиск", href: "/app/customer/search" },
    },
    "customer-pilots": {
      title: "Пилотных проектов пока нет",
      description: "Пилоты по запросам вашей организации появятся здесь.",
    },
    shortlists: {
      title: "Шорт-листов пока нет",
      description:
        "Сохраняйте сравнения технологий и исполнителей для быстрого доступа.",
    },
    "partner-technologies": {
      title: "У организации пока нет поданных технологий",
      description:
        "Подайте технологию — путь готовности начнётся с черновика досье.",
      action: { label: "Подать технологию", href: "/app/partner/technologies/new" },
    },
    applications: {
      title: "Заявок пока нет",
      description: "Заявки на запросы заказчиков и пилоты появятся здесь.",
    },
    "partner-requests": {
      title: "Открытых запросов заказчиков нет",
      description:
        "Запросы, подходящие под технологии вашей организации, появятся здесь.",
    },
    "partner-pilots": {
      title: "Пилотных проектов пока нет",
      description: "Участие в пилотах появится здесь после подачи заявки.",
    },
    "science-research": {
      title: "Пока нет записей НИОКТР вашей организации",
      description:
        "Публикация исследований и связь с технологиями появятся здесь.",
    },
    "science-partners": {
      title: "Связанных партнёров пока нет",
      description:
        "Организации и запросы по направлениям вашей организации появятся здесь.",
    },
    "manufacturer-technologies": {
      title: "Технологий к внедрению пока не отмечено",
      description:
        "Проверенные технологии для производства появятся здесь.",
    },
    "manufacturer-pilots": {
      title: "Пилотов для внедрения нет",
      description: "Пилотные проекты с участием вашей организации появятся здесь.",
    },
    "regulator-reviews": {
      title: "Назначенных проверок соответствия нет",
      description: "Проверки по вашей области регулирования появятся здесь.",
    },
    "regulator-history": {
      title: "Завершённых проверок нет",
      description: "История проверок и решений появится здесь.",
    },
    "expert-queue": {
      title: "В очереди проверок пока нет назначенных работ",
      description: "Назначенные проверки свидетельств появятся здесь.",
    },
    "expert-history": {
      title: "Завершённых проверок пока нет",
      description: "История проверок и рекомендаций появится здесь.",
    },
    "investor-technologies": {
      title: "Проверенных возможностей пока нет",
      description:
        "Технологии после верификации Центра появятся здесь.",
    },
    expertise: {
      title: "Запросов на экспертизу нет",
      description: "Оценка возможностей и экспертные отчёты появятся здесь.",
    },
    watchlist: {
      title: "Отслеживаемых возможностей пока нет",
      description: "Сохраняйте технологии, чтобы следить за их прогрессом.",
    },
    "ops-queue": {
      title: "Очередь пуста",
      description:
        "Задачи на проверку, публикацию и решения появятся здесь, когда поступят подачи.",
    },
  };

/** Секции кабинета роли: общие разделы + ролевые в порядке приоритета. */
export function getSectionsForRole(id: BackendRoleId): {
  shared: SectionDef[];
  role: SectionDef[];
} {
  const definition = getRoleDefinition(id) ?? BACKEND_ROLES[0];
  const byId = new Map(APP_SECTIONS.map((section) => [section.id, section]));
  const shared = APP_SECTIONS.filter((section) => section.group === "shared");
  const role = definition.sections
    .map((sectionId) => byId.get(sectionId))
    .filter((section): section is SectionDef => Boolean(section));
  return { shared, role };
}
