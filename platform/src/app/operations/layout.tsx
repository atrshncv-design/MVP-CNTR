"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, type SidebarGroup } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileMenu } from "@/components/profile-menu";
import { RoleSwitcher } from "@/components/role-switcher";
import { MobileDrawer } from "@/components/mobile-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  OPERATIONS_GROUPS,
  OPERATIONS_SECTIONS,
  getRoleDefinition,
  isCenterRole,
  sectionBreadcrumb,
} from "@/lib/roles";
import { getMockSession, type MockSession } from "@/lib/session";

/** Скелет шелла на время чтения mock-сессии (localStorage доступен только в браузере). */
function ShellLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div
        role="status"
        aria-live="polite"
        aria-label="Загружаем операционный центр"
        className="w-full max-w-md space-y-3"
      >
        <p className="text-small text-muted">Загружаем операционный центр…</p>
        <div className="h-9 animate-pulse rounded-control bg-surface-elevated" />
        <div className="h-9 animate-pulse rounded-control bg-surface-elevated" />
        <div className="h-9 animate-pulse rounded-control bg-surface-elevated" />
      </div>
    </div>
  );
}

/**
 * T-003. Операционный шелл Центра (Design.md §3.3): очередь-first, плотная
 * композиция, своя навигация (Очередь/Подачи/Проверка/Реестр технологий/
 * Запросы/Организации/НИОКТР/Пилоты/Решения/Аналитика/Настройки).
 *
 * Доступ — роли Центра (cntr_manager/cntr_admin); без mock-сессии — редирект
 * на /login; участник с ролью не-Центра — на стартовый маршрут своего кабинета
 * (честное ролевое ограничение, не «404 пустота»). Полноценный auth — T-013.
 */
export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      if (!isCenterRole(mockSession.role)) {
        router.replace(getRoleDefinition(mockSession.role)?.home ?? "/app");
        return;
      }
      setSession(mockSession);
      setReady(true);
    })();
  }, [router]);

  /* Drawer закрывается при смене маршрута. */
  useEffect(() => {
    (async () => {
      setDrawerOpen(false);
    })();
  }, [pathname]);

  if (!ready || !session) return <ShellLoading />;

  const groups: SidebarGroup[] = OPERATIONS_GROUPS.map((group) => ({
    title: group.title,
    items: group.items
      .map((id) => OPERATIONS_SECTIONS.find((section) => section.id === id))
      .filter((section): section is (typeof OPERATIONS_SECTIONS)[number] =>
        Boolean(section),
      ),
  }));

  const { title, crumbs } = sectionBreadcrumb(pathname, OPERATIONS_SECTIONS);

  const sidebarContent = (
    <Sidebar
      groups={groups}
      activePath={pathname}
      density="dense"
      navLabel="Навигация операционного центра"
      brandSubtitle="Операционный центр"
      brandHref="/operations"
      footer={
        <div className="space-y-2.5">
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
      {/* Sidebar (desktop, фиксированный): плотный, уже кабинетного */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-border-subtle lg:block">
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[232px]">
        <TopBar
          title={title}
          breadcrumbs={crumbs}
          density="dense"
          onMenuOpen={() => setDrawerOpen(true)}
          menuLabel="Открыть меню операционного центра"
          right={
            <>
              <NotificationBell />
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <ProfileMenu
                session={session}
                density="dense"
                items={[
                  { label: "Настройки центра", href: "/operations/settings" },
                ]}
              />
            </>
          }
        />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 md:px-6">
          {children}
        </main>
      </div>

      {/* Sidebar (mobile): drawer с оверлеем */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Меню операционного центра"
      >
        <Sidebar
          groups={groups}
          activePath={pathname}
          density="dense"
          showBrand={false}
          navLabel="Навигация операционного центра"
          footer={
            <div className="space-y-2.5">
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
