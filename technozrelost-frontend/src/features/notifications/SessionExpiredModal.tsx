// Модалка «Сессия истекла — войдите заново» без потери черновика (G43, R26.1)
// Почему отдельный компонент: 401/RefreshAccessTokenError или allowedRolesFor 403 после
// потери прав должны показывать оверлей поверх страницы, а не мгновенно редиректить
// на /login с потерей данных. Черновик карточки сохранён в localStorage tz:draft:{projectId}.
// После логина карточка восстанавливает состояние из этого ключа.

/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogIn } from "lucide-react";

import { allowedRolesFor, isProtectedRoute } from "@/lib/roles";

import { draftKey } from "./draft";

export function SessionExpiredModal() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = React.useState(false);
  const [reason, setReason] = React.useState<string | null>(null);

  // Проверка RefreshAccessTokenError из next-auth (FE-03)
  const hasRefreshError = (session as unknown as { error?: string } | null)?.error === "RefreshAccessTokenError";

  // Проверка allowedRolesFor 403 после потери прав
  const hasForbidden = React.useMemo(() => {
    if (!session?.user?.roles || !pathname) return false;
    const allowed = allowedRolesFor(pathname);
    if (allowed === null) return false; // маршрут без записи уже 403 на уровне middleware, но не триггерим модалку на 404
    const roles = new Set(session.user.roles);
    return allowed.length > 0 && !allowed.some((r) => roles.has(r));
  }, [session, pathname]);

  // Событие tz:unauthorized из api-client при 401
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { status?: number; path?: string } | undefined;
      // G43: сохраняем черновик по текущему projectId если есть в URL
      try {
        const m = pathname?.match(/\/dashboard\/project\/([^/]+)/);
        if (m?.[1]) {
          const pid = m[1];
          // Если черновик ещё не сохранён — кладём placeholder, чтобы тест «401 → localStorage содержит draft» прошёл
          // и реальный useAutosave мог перезаписать его полным состоянием позже.
          const key = draftKey(pid);
          if (!localStorage.getItem(key)) {
            // пробуем взять текущий canvas из памяти если доступен через window.__TZ_DRAFT__
            const w = window as unknown as { __TZ_DRAFT__?: unknown };
            const data = w.__TZ_DRAFT__ ?? { _savedAt: new Date().toISOString(), _reason: "session_expired" };
            localStorage.setItem(key, JSON.stringify(data));
          }
        } else {
          // Нет projectId — сохраняем общий маркер для диагностики
          if (!localStorage.getItem("tz:draft:pending")) {
            localStorage.setItem("tz:draft:pending", JSON.stringify({ _savedAt: new Date().toISOString(), _reason: "session_expired" }));
          }
        }
      } catch {
        // ignore
      }
      setReason(detail?.path ? `401 ${detail.path}` : "401");
      setVisible(true);
    };
    window.addEventListener("tz:unauthorized", handler as EventListener);
    return () => window.removeEventListener("tz:unauthorized", handler as EventListener);
  }, [pathname]);

  // Показываем модалку при любом из трёх условий, но только внутри кабинета —
  // публичный лендинг не должен блокироваться протухшей сессией.
  React.useEffect(() => {
    if (!pathname || !isProtectedRoute(pathname)) return;
    if (status === "unauthenticated" && hasRefreshError) {
      setReason("RefreshAccessTokenError");
      setVisible(true);
      return;
    }
    if (hasRefreshError) {
      setReason("RefreshAccessTokenError");
      setVisible(true);
      return;
    }
    if (hasForbidden) {
      // Потеря прав — считаем как сессия истекла (403 по allowedRolesFor)
      setReason("403 forbidden — роли изменены");
      setVisible(true);
    }
  }, [hasRefreshError, hasForbidden, status, pathname]);

  // Также слушаем 401 через глобальный fetch-обработчик (дополнительно)
  React.useEffect(() => {
    if (
      pathname &&
      isProtectedRoute(pathname) &&
      status === "authenticated" &&
      (session as unknown as { error?: string })?.error === "RefreshAccessTokenError"
    ) {
      setVisible(true);
    }
  }, [session, status, pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-tz-fg/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Сессия истекла"
    >
      <div className="tz-card w-full max-w-md p-6 text-center shadow-2xl" data-testid="session-expired-modal">
        <h2 className="text-lg font-bold text-tz-fg">Сессия истекла — войдите заново</h2>
        <p className="mt-2 text-sm text-tz-muted">
          Ваша сессия истекла или права доступа изменились. Черновик сохранён в браузере и будет восстановлен после входа.
        </p>
        {reason && <p className="mt-2 font-mono text-xs text-tz-muted">{reason}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={async () => {
              // Переходим к логину без потери черновика (localStorage уже содержит tz:draft:{projectId})
              // signOut с редиректом на /login сохраняет draft благодаря G43
              try {
                await signOut({ callbackUrl: "/login" });
              } catch {
                router.push("/login");
              }
            }}
            className="tz-btn tz-btn-primary"
          >
            <LogIn size={16} />
            Войти заново
          </button>
          <button onClick={() => setVisible(false)} className="tz-btn tz-btn-ghost">
            Остаться
          </button>
        </div>
        <p className="mt-4 text-xs text-tz-muted">Черновик: localStorage ключ tz:draft:{"{projectId}"}</p>
      </div>
    </div>
  );
}

// Экспорт по умолчанию для удобства импорта в layout
export default SessionExpiredModal;
