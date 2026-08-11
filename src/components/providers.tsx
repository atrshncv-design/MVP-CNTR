"use client";

import { signOut, useSession, SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { useEffect } from "react";

function SessionExpiryWatcher() {
  const { data: session } = useSession();

  useEffect(() => {
    // Refresh-цикл не смог обновить access-токен (истёк refresh, 14 дней)
    // или сессия в принципе невалидна — отправляем на вход.
    const tokenError = (session as { error?: string } | null)?.error;
    if (tokenError === "RefreshAccessTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MotionConfig reducedMotion="user">
        <SessionExpiryWatcher />
        {children}
      </MotionConfig>
    </SessionProvider>
  );
}
