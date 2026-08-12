import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth.config";
import { ApiError, getProjects } from "@/lib/api-client";
import CollapsibleSidebar from "@/components/dashboard/collapsible-sidebar";
import ProjectsExplorer from "./projects-explorer";

/** Честные ссылки для сворачиваемой панели «Навигация по разделу» (тикет 03). */
const SECTION_LINKS = [
  { href: "/dashboard", label: "Рабочий стол" },
  { href: "/dashboard/projects", label: "Проекты" },
  { href: "/dashboard/gk_customer/projects/new", label: "Заявки" },
  { href: "/dashboard/nioktr", label: "НИОКТР" },
  { href: "/dashboard/organizations", label: "Организации" },
  { href: "/dashboard/technologies", label: "Реестры" },
];

export default async function ProjectsPage() {
  const session = await auth();
  let projects;

  try {
    projects = await getProjects(session!.user.accessToken);
  } catch (error) {
    const unavailable = error instanceof ApiError && error.status >= 500;
    return (
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
          Проекты
        </p>
        <h1 className="tz-page-title mt-2">Не удалось загрузить проекты</h1>
        <div className="mt-7 rounded-[14px] border border-tz-danger bg-tz-surface p-6">
          <p className="font-semibold text-tz-danger">
            {unavailable ? "Сервис проектов временно недоступен" : "Нет доступа к данным проектов"}
          </p>
          <p className="mt-2 text-tz-secondary">
            Обновите страницу позже или обратитесь к менеджеру ЦНТР.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-tz-border pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
            Единый рабочий контур
          </p>
          <h1 className="tz-page-title mt-2">Проекты</h1>
          <p className="mt-2 text-tz-secondary">Доступны только проекты в области вашей роли.</p>
        </div>
        {session?.user.roles.includes("gk_customer") && (
          <Link
            href="/dashboard/gk_customer/projects/new"
            className="tz-btn tz-btn-primary"
          >
            Создать заявку
          </Link>
        )}
      </div>

      {/* Тикет 03: CollapsibleSidebar — сворачиваемая боковая панель
          (состояние в localStorage tz-sidebar-projects-nav). Desktop: колонка
          260px + контент; mobile: панель над списком. */}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <CollapsibleSidebar
          id="projects-nav"
          title="Навигация по разделу"
          defaultOpen={false}
          className="lg:sticky lg:top-20"
        >
          <nav aria-label="Разделы платформы">
            <ul className="space-y-0.5">
              {SECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-lg px-2.5 py-1.5 text-sm text-tz-secondary transition hover:bg-tz-surface-2 hover:text-tz-fg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </CollapsibleSidebar>
        <div className="min-w-0">
          {/* Suspense — документированный паттерн для useSearchParams:
              клиентский проводник читает фильтры из URL без деоптимизации страницы.
              Рендерится всегда (даже при пустом списке), чтобы поиск/фильтры/
              переключатель вида/пагинация были доступны — тикет 04/07. */}
          <Suspense fallback={null}>
            <ProjectsExplorer projects={projects} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
