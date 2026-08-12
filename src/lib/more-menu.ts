import {
  Building2,
  Database,
  FileText,
  FlaskConical,
  UserRound,
  Award,
  Users,
  type LucideIcon,
} from "lucide-react";
import { allowedRolesFor } from "@/lib/roles";

/**
 * Пункты dropdown «Больше функций» (тикет 01–02 спеки internal-ux-redesign).
 * Карточки сетки: только иконка + название; неготовая функция помечается
 * маленьким вторичным бейджем «В разработке» (isReady === false).
 * Путь до источника истины — src/lib/roles.ts (карта маршрутов), не менять.
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
  { label: "Документы", href: "/dashboard/ai-assistant", icon: FileText, isReady: true },
  // Будущая функция (тикет 05 — реестр специалистов): пункт виден с бейджем
  // «В разработке»; маршрут уже защищён картой ролей (не для auditor/investor/…).
  { label: "Исполнители", href: "/dashboard/executors", icon: Users, isReady: false },
  { label: "Профиль", href: "/dashboard/profile", icon: UserRound, isReady: true },
  { label: "Достижения", href: "/dashboard/achievements", icon: Award, isReady: true },
];

/**
 * Ролевая фильтрация пунктов «Больше функций» (тикет 02).
 * Пункт виден, если его маршрут не ограничен картой ролей
 * (allowedRolesFor → null: доступен любому залогиненному) либо хотя бы одна
 * роль текущей сессии входит в список разрешённых. Источник истины —
 * ROUTE_ALLOWED_ROLES / allowedRolesFor из src/lib/roles.ts — тот же, что
 * использует middleware, поэтому меню не показывает ссылки, которые
 * middleware всё равно запретит (rewrite на /forbidden).
 */
export function getVisibleMenuItems(userRoles: string[]): MoreMenuItem[] {
  return MORE_MENU_ITEMS.filter((item) => {
    const allowed = allowedRolesFor(item.href);
    return allowed === null || allowed.some((role) => userRoles.includes(role));
  });
}
