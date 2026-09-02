"use client";

import { signOut, useSession, SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { OfflineBanner } from "@/features/offline/OfflineBanner";
import { isProtectedRoute } from "@/lib/roles";

function SessionExpiryWatcher() {
  const { data: session } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    // Refresh-цикл не смог обновить access-токен (истёк refresh, 14 дней)
    // или сессия в принципе невалидна — отправляем на вход, но только из
    // защищённых разделов. Публичный лендинг остаётся доступным.
    const tokenError = (session as { error?: string } | null)?.error;
    if (tokenError === "RefreshAccessTokenError" && pathname && isProtectedRoute(pathname)) {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session, pathname]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionExpiryWatcher />
      {/* P3 R04: глобальный баннер offline + очередь localStorage `tz:offline:queue` + sync после online */}
      <OfflineBanner />
      {children}
    </SessionProvider>
  );
}
