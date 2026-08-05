import Link from "next/link";
import { auth, signOut } from "@/auth.config";
import NotificationBell from "@/components/notification-bell";

const navigation = [
  { href: "/dashboard", label: "Рабочий стол" },
  { href: "/dashboard/projects", label: "Проекты" },
  { href: "/dashboard/gk_customer/projects/new", label: "Заявки" },
  { href: "/dashboard/technologies", label: "Реестры" },
  { href: "/dashboard/nioktr", label: "НИОКТР" },
  { href: "/dashboard/organizations", label: "Организации" },
  { href: "/dashboard/profile", label: "Профиль" },
  { href: "/dashboard/ai-assistant", label: "Документы" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-tz-bg">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded bg-tz-surface px-3 py-2 font-semibold text-tz-fg shadow focus:translate-y-0"
      >
        Перейти к основному содержимому
      </a>
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0a101f]/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[64px] max-w-[1440px] items-center gap-8 px-5 sm:px-8">
          <Link href="/dashboard" className="group flex shrink-0 items-center gap-2.5">
            <span
              className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#2e5bff] via-[#7c5cff] to-[#00d4c8] font-mono text-[13px] font-bold text-white shadow-[0_4px_18px_rgba(90,100,255,0.45)] transition-transform group-hover:scale-105"
              aria-hidden="true"
            >
              ТЗ
            </span>
            <span className="font-mono text-sm font-bold tracking-[0.08em] text-white">
              ТЕХНОЗРЕЛОСТЬ
            </span>
          </Link>
          <nav aria-label="Основная навигация" className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-tz-muted transition hover:bg-tz-surface/[0.06] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          
          <NotificationBell /><div className="ml-auto flex items-center gap-4">
            {session?.user && (
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold text-white">
                  {session.user.name ?? session.user.email}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-tz-muted">
                  {session.user.roles.join(" · ")}
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
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-tz-muted transition hover:border-white/25 hover:text-white"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
