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
  label: string;
  href: string;
  icon: LucideIcon;
  isReady: boolean;
}

/** Заголовок кнопки-триггера dropdown. */
export const MORE_MENU_LABEL = "Больше функций";

export const MORE_MENU_ITEMS: MoreMenuItem[] = [
  { label: "Реестры", href: "/dashboard/technologies", icon: Database, isReady: true },
  { label: "НИОКТР", href: "/dashboard/nioktr", icon: FlaskConical, isReady: true },
  { label: "Организации", href: "/dashboard/organizations", icon: Building2, isReady: true },
  { label: "Новости", href: "/dashboard/news", icon: Newspaper, isReady: true },
  // Админ-раздел новостей (тикет 07): виден только сотрудникам ЦНТР —
  // маршрут ограничен картой ролей (/dashboard/news/admin → cntr_admin/cntr_manager).
  { label: "Новости: админ", href: "/dashboard/news/admin", icon: ShieldCheck, isReady: true },
  // Реестр специалистов: страница живёт на платформе.
  { label: "Исполнители", href: "/dashboard/executors", icon: Users, isReady: true },
  { label: "Документы", href: "/dashboard/ai-assistant", icon: FileText, isReady: true },
  // Профиль включает витрину «Мои достижения»; аналитика достижений —
  // вкладка кабинета cntr_admin («Рабочий стол» ведёт в кабинет роли).
  { label: "Профиль", href: "/dashboard/profile", icon: UserRound, isReady: true },
  // Уведомления (тикет 07): колокольчик + страница, доступна всем ролям
  { label: "Уведомления", href: "/dashboard/notifications", icon: Bell, isReady: true },
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
