"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, type SidebarGroup } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileMenu } from "@/components/profile-menu";
import { RoleSwitcher } from "@/components/role-switcher";
import { MobileDrawer } from "@/components/mobile-drawer";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getRoleDefinition,
  getSectionsForRole,
  isCenterRole,
  sectionBreadcrumb,
  type SectionDef,
} from "@/lib/roles";
import { getMockSession, type MockSession } from "@/lib/session";

/** Скелет шелла на время чтения mock-сессии (localStorage доступен только в браузере). */
function ShellLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div
        role="status"
        aria-live="polite"
        aria-label="Загружаем рабочий стол"
        className="w-full max-w-md space-y-3"
      >
        <p className="text-small text-muted">Загружаем рабочий стол…</p>
        <div className="h-11 animate-pulse rounded-control bg-surface-elevated" />
        <div className="h-11 animate-pulse rounded-control bg-surface-elevated" />
        <div className="h-11 animate-pulse rounded-control bg-surface-elevated" />
      </div>
    </div>
  );
}

/**
 * T-003. Авторизованный шелл участника (Design.md §3.2/§4.2/§8.2):
 * левый sidebar 248–280px (общие разделы + ролевые по приоритету роли),
 * контекстный top bar (заголовок/хлебные крошки, поиск, уведомления, тема,
 * профиль), мобильный drawer с оверлеем.
 *
 * Без mock-сессии — редирект на /login (полноценный auth — T-013).
 * Роли Центра (владельцы операционного шелла) перенаправляются на /operations.
 * Каркас стабилен при loading/empty/error дочерних страниц.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<MockSession | null>(null);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const mockSession = getMockSession();
      if (!mockSession) {
        router.replace("/login");
        return;
      }
      if (isCenterRole(mockSession.role)) {
        router.replace("/operations");
        return;
      }
      setSession(mockSession);
      setReady(true);
    })();
  }, [router]);

  /* Drawer закрывается при смене маршрута (текущий раздел виден в top bar). */
  useEffect(() => {
    (async () => {
      setDrawerOpen(false);
    })();
  }, [pathname]);

  if (!ready || !session) return <ShellLoading />;

  const definition = getRoleDefinition(session.role) ?? null;
  const { shared, role } = getSectionsForRole(session.role);
  const allSections: SectionDef[] = [...shared, ...role];

  const groups: SidebarGroup[] = [
    { items: shared },
    definition ? { title: definition.label, items: role } : { items: role },
  ];

  const { title, crumbs } = sectionBreadcrumb(pathname, allSections);

  const sidebarContent = (
    <Sidebar
      groups={groups}
      activePath={pathname}
      density="comfortable"
      navLabel="Навигация кабинета"
      brandSubtitle="Личный кабинет"
      brandHref="/app"
      footer={
        <div className="space-y-3">
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
          <RoleSwitcher current={session.role} />
        </div>
      }
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Sidebar (desktop, фиксированный): 248px, до 264px на широких экранах */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-border-subtle lg:block xl:w-[264px]">
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px] xl:pl-[264px]">
        <TopBar
          title={title}
          breadcrumbs={crumbs}
          onMenuOpen={() => setDrawerOpen(true)}
          menuLabel="Открыть меню кабинета"
          right={
            <>
              <GlobalSearch />
              <NotificationBell linkHref="/app/notifications" />
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <ProfileMenu session={session} />
            </>
          }
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-6 md:px-8">
          {children}
        </main>
      </div>

      {/* Sidebar (mobile): drawer с оверлеем */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Меню кабинета"
      >
        <Sidebar
          groups={groups}
          activePath={pathname}
          density="comfortable"
          showBrand={false}
          navLabel="Навигация кабинета"
          footer={
            <div className="space-y-3">
              <div className="flex justify-center">
                <ThemeToggle />
              </div>
              <RoleSwitcher current={session.role} />
            </div>
          }
          onNavigate={() => setDrawerOpen(false)}
        />
      </MobileDrawer>
    </div>
  );
}
