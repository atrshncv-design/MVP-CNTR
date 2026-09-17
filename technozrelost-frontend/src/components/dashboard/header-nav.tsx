"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bot, type LucideIcon } from "lucide-react";
import MoreFunctionsMenu from "@/components/dashboard/more-functions-menu";

export interface HeaderNavItem {
  href: string;
  label: string;
}

/**
 * Иконки пунктов верхнего меню по смыслу маршрута. AI-ассистент — Bot
 * (та же метафора, что на самой странице /dashboard/ai-assistant).
 */
const NAV_ICONS: Partial<Record<string, LucideIcon>> = {
  "/dashboard/ai-assistant": Bot,
};

function isActive(href: string, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  if (href === "/dashboard") return path === "/dashboard";
  return path === href || path.startsWith(`${href}/`);
}

/**
 * Основная навигация шапки: «Рабочий стол», «Проекты», «Заявки»,
 * «AI-ассистент» + кнопка «Больше функций». Используется и в desktop-шапке
 * (горизонтально), и внутри mobile-меню (vertical). Активный пункт
 * подсвечивается токенами.
 */
export default function HeaderNav({
  items,
  vertical = false,
  onNavigate,
  userRoles,
}: {
  items: HeaderNavItem[];
  vertical?: boolean;
  onNavigate?: () => void;
  /** Роли сессии для ролевой фильтрации пунктов «Больше функций». */
  userRoles?: string[];
}) {
  const pathname = usePathname();
  const t = useTranslations("dashboard");

  return (
    <nav aria-label={t("mainNavAria")} className={vertical ? "w-full" : "flex items-center gap-1"}>
      <ul
        className={
          vertical ? "flex flex-col gap-0.5" : "flex items-center gap-1"
        }
      >
        {items.map((item) => {
          const active = isActive(item.href, pathname);
          const Icon = NAV_ICONS[item.href];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-tz-accent-soft text-tz-accent"
                    : "text-tz-secondary hover:bg-tz-surface-2 hover:text-tz-fg"
                }`}
              >
                {Icon && <Icon size={15} aria-hidden="true" />}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={vertical ? "mt-1 border-t border-tz-border pt-1" : ""}>
        <MoreFunctionsMenu onNavigate={onNavigate} userRoles={userRoles} />
      </div>
    </nav>
  );
}
