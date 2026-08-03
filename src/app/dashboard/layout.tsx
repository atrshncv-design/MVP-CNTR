import Link from "next/link";
import { auth, signOut } from "@/auth.config";

const navigation = [
  { href: "/dashboard", label: "Рабочий стол" },
  { href: "/dashboard/projects", label: "Проекты" },
  { href: "/dashboard/gk_customer/projects/new", label: "Заявки" },
  { href: "/dashboard/technologies", label: "Реестры" },
  { href: "/dashboard/ai-assistant", label: "Документы" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-tz-bg">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded bg-white px-3 py-2 font-semibold text-tz-fg shadow focus:translate-y-0"
      >
        Перейти к основному содержимому
      </a>
      <header className="border-b border-tz-hero-border bg-tz-hero text-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center gap-8 px-5 sm:px-8">
          <Link href="/dashboard" className="shrink-0 font-mono text-sm font-bold tracking-[0.08em]">
            ТЕХНОЗРЕЛОСТЬ<span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-tz-accent" aria-hidden="true" />
          </Link>
          <nav aria-label="Основная навигация" className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-tz-hero-muted transition hover:bg-tz-hero-border hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tz-accent-hover"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            {session?.user && (
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold">{session.user.name ?? session.user.email}</div>
                <div className="text-xs text-tz-hero-muted">{session.user.roles.join(" · ")}</div>
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
                className="rounded-lg border border-tz-hero-border px-3 py-2 text-sm text-tz-hero-muted transition hover:border-tz-hero-muted hover:text-white"
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
