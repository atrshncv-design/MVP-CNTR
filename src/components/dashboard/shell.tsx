import Link from "next/link";
import { signOut } from "@/auth.config";

import NotificationBell from "@/components/notification-bell";
import TolezeLogo from "@/components/brand/toleze-logo";
import { DashboardNav, MobileNavToggle } from "@/components/dashboard/nav";

import { navItemsForRoles } from "@/lib/navigation";

/**
 * Единый dashboard shell для всех ролей (тикет 01, internal-frontend).
 *
 * - Один layout для девяти ролей: навигация строится картой роль→пункты
 *   (src/lib/navigation.ts) из реальных маршрутов; ролевые пункты появляются
 *   только у ролей, которым маршрут разрешён (middleware/backend не заменяются).
 * - Семантика: skip-link → #main-content, landmarks header/nav/main,
 *   aria-current="page" у активного пункта, мобильное меню с aria-expanded.
 */
export function DashboardShell({
  userName,
  roles,
  children,
}: {
  userName?: string | null;
  roles: string[];
  children: React.ReactNode;
}) {
  const items = navItemsForRoles(roles);

  return (
    <div className="min-h-screen bg-tz-bg">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded bg-tz-surface px-3 py-2 font-semibold text-tz-fg shadow focus:translate-y-0"
      >
        Перейти к основному содержимому
      </a>
      <header className="relative sticky top-0 z-40 border-b border-white/[0.07] bg-[#0a101f]/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[64px] max-w-[1440px] flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2 sm:gap-x-3 sm:px-8">
          <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5">
            <TolezeLogo size={32} className="transition-transform group-hover:scale-105" />
            <span className="hidden font-mono text-sm font-bold tracking-[0.08em] text-white sm:block">
              ТЕХНОЗРЕЛОСТЬ
            </span>
          </Link>

          <DashboardNav items={items} />

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            {userName && (
              <div className="hidden text-right lg:block">
                <div className="text-sm font-semibold text-white">{userName}</div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-tz-muted">
                  {roles.join(" · ")}
                </div>
              </div>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-white/10 px-3 py-2 text-sm text-tz-muted transition hover:border-white/25 hover:text-white"
              >
                Выйти
              </button>
            </form>
          </div>

          <MobileNavToggle items={items} />
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
