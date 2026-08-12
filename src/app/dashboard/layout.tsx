import Link from "next/link";
import { auth, signOut } from "@/auth.config";
import NotificationBell from "@/components/notification-bell";
import TolezeLogo from "@/components/brand/toleze-logo";
import HeaderNav from "@/components/dashboard/header-nav";
import MobileNav from "@/components/dashboard/mobile-nav";
import DashboardBreadcrumb, {
  BreadcrumbProvider,
} from "@/components/dashboard/dashboard-breadcrumb";
import { ROLES } from "@/lib/roles";

/**
 * Компактная шапка ЛК (тикет 01 internal-ux-redesign):
 * логотип + «Рабочий стол» / «Проекты» / «Заявки» + «Больше функций»
 * (dropdown, см. more-functions-menu.tsx) + уведомления + профиль + выход.
 * Остальные функции (Реестры, НИОКТР, Организации, Документы, Профиль)
 * переехали в сетку «Больше функций» (src/lib/more-menu.ts).
 * Mobile shell: логотип + кнопка меню (mobile-nav.tsx).
 */
const coreNavigation = [
  { href: "/dashboard", label: "Рабочий стол" },
  { href: "/dashboard/projects", label: "Проекты" },
  { href: "/dashboard/gk_customer/projects/new", label: "Заявки" },
];

/** Инициалы для аватара профиля. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** Русские названия ролей из карты ролей (fallback — slug). */
function roleNames(roles: string[]): string {
  return roles
    .map((slug) => ROLES.find((r) => r.slug === slug)?.name ?? slug)
    .filter(Boolean)
    .join(" · ");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="min-h-screen bg-tz-bg">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded bg-tz-surface px-3 py-2 font-semibold text-tz-fg shadow focus:translate-y-0"
      >
        Перейти к основному содержимому
      </a>
      <header
        className="sticky top-0 z-40 border-b border-tz-border bg-tz-surface/90 backdrop-blur-xl"
        style={{ boxShadow: "var(--tz-shadow-card)" }}
      >
        <div className="mx-auto flex min-h-[60px] max-w-[1440px] items-center gap-2 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5">
            <TolezeLogo size={30} className="transition-transform group-hover:scale-105" />
            <span className="hidden font-mono text-sm font-bold tracking-[0.08em] text-tz-fg lg:inline">
              ТЕХНОЗРЕЛОСТЬ
            </span>
          </Link>

          {/* Desktop: навигация + «Больше функций» (ролевая фильтрация — тикет 02) */}
          <div className="ml-2 hidden md:block">
            <HeaderNav items={coreNavigation} userRoles={user?.roles ?? []} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Уведомления */}
            <div className="hidden md:block">
              <NotificationBell />
            </div>

            {/* Профиль: аватар с инициалами + имя/роль (компактно на lg+) */}
            {user && (
              <Link
                href="/dashboard/profile"
                className="hidden items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-tz-surface-2 sm:flex"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tz-accent-soft font-mono text-xs font-bold text-tz-accent">
                  {initials(user.name ?? user.email ?? "?")}
                </span>
                <span className="hidden text-left lg:block">
                  <span className="block max-w-[200px] truncate text-sm font-semibold text-tz-fg">
                    {user.name ?? user.email ?? "Пользователь"}
                  </span>
                  <span className="block font-mono text-[11px] uppercase tracking-wider text-tz-muted">
                    {roleNames(user.roles)}
                  </span>
                </span>
              </Link>
            )}

            {/* Выход */}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-tz-border px-2.5 py-2.5 text-sm text-tz-muted transition hover:border-tz-fg/25 hover:text-tz-fg sm:px-3"
              >
                Выйти
              </button>
            </form>

            {/* Mobile: кнопка меню */}
            <div className="md:hidden">
              <MobileNav items={coreNavigation} userRoles={user?.roles ?? []} />
            </div>
          </div>
        </div>
      </header>
      {/* Тикет 03: единый обязательный breadcrumb (провайдер позволяет
          страницам переопределить цепочку через useBreadcrumb) + широкая
          рабочая область (max-w-[1440px] — как у шапки). */}
      <BreadcrumbProvider>
        <main id="main-content" className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8">
          <DashboardBreadcrumb />
          {children}
        </main>
      </BreadcrumbProvider>
    </div>
  );
}
