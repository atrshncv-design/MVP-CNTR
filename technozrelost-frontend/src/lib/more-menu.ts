import {
  Bell,
  Building2,
  Database,
  FileText,
  FlaskConical,
  Newspaper,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { allowedRolesFor } from "@/lib/roles";

/**
 * Пункты dropdown «Больше функций» (по образцу internal-ux-redesign).
 * Карточки сетки: иконка + название; неготовая функция помечается бейджем
 * «В разработке» (isReady === false). Источник истины ролей —
 * src/lib/roles.ts (ROUTE_ALLOWED_ROLES / allowedRolesFor), не менять.
 */
export interface MoreMenuItem {
  /** Ключ словаря common для подписи пункта; метку резолвит потребитель через t. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  isReady: boolean;
}

/** Ключ словаря common для заголовка кнопки-триггера dropdown. */
export const MORE_MENU_LABEL_KEY = "moreMenuTrigger";

export const MORE_MENU_ITEMS: MoreMenuItem[] = [
  { labelKey: "moreMenuRegistries", href: "/dashboard/technologies", icon: Database, isReady: true },
  { labelKey: "moreMenuNioktr", href: "/dashboard/nioktr", icon: FlaskConical, isReady: true },
  { labelKey: "moreMenuOrgs", href: "/dashboard/organizations", icon: Building2, isReady: true },
  { labelKey: "moreMenuNews", href: "/dashboard/news", icon: Newspaper, isReady: true },
  // Админ-раздел новостей (тикет 07): виден только сотрудникам ЦНТР —
  // маршрут ограничен картой ролей (/dashboard/news/admin → cntr_admin/cntr_manager).
  { labelKey: "moreMenuNewsAdmin", href: "/dashboard/news/admin", icon: ShieldCheck, isReady: true },
  // Реестр специалистов: страница живёт на платформе.
  { labelKey: "moreMenuExecutors", href: "/dashboard/executors", icon: Users, isReady: true },
  { labelKey: "moreMenuDocs", href: "/dashboard/ai-assistant", icon: FileText, isReady: true },
  // Профиль включает витрину «Мои достижения»; аналитика достижений —
  // вкладка кабинета cntr_admin («Рабочий стол» ведёт в кабинет роли).
  { labelKey: "moreMenuProfile", href: "/dashboard/profile", icon: UserRound, isReady: true },
  // Уведомления (тикет 07): колокольчик + страница, доступна всем ролям
  { labelKey: "moreMenuNotifications", href: "/dashboard/notifications", icon: Bell, isReady: true },
];

/**
 * Ролевая фильтрация пунктов «Больше функций»: пункт виден, только если
 * маршрут есть в матрице ролей и хотя бы одна роль сессии входит в список
 * разрешённых — тот же источник истины, что middleware, поэтому меню не
 * показывает ссылки, которые middleware перепишет на /forbidden.
 * Fail-closed (FE-01): allowedRolesFor → null («маршрут вне матрицы»)
 * трактуется как запрет, а не как «без ограничений»; пустые/неизвестные
 * роли (undefined, null, []) дают только явно разрешённые им пункты —
 * админ-пункты появляются лишь при явном наличии роли из src/lib/roles.ts.
 */
export function getVisibleMenuItems(userRoles?: string[] | null): MoreMenuItem[] {
  const known = userRoles ?? [];
  return MORE_MENU_ITEMS.filter((item) => {
    const allowed = allowedRolesFor(item.href);
    return allowed !== null && allowed.some((role) => known.includes(role));
  });
}
