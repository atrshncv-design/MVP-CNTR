import { NextResponse } from "next/server";
import { auth } from "@/auth.config";
import {
  allowedRolesFor,
  isAuthRoute,
  isProtectedRoute,
  ROLE_DASHBOARD,
  type RoleSlug,
} from "@/lib/roles";

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const session = req.auth as unknown as { user?: { roles: string[] }; error?: string } | null;
  const isLoggedIn = !!session?.user;

  // FE-03: RefreshAccessTokenError → /login (бэкенд отказал в refresh, сессия невалидна).
  if ((session as { error?: string } | null)?.error === "RefreshAccessTokenError") {
    if (pathname === "/login") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 1. Auth-маршруты: залогиненного пользователя отправляем в его кабинет.
  if (isAuthRoute(pathname)) {
    if (isLoggedIn) {
      const primary = (session!.user!.roles[0] as RoleSlug) ?? "gk_customer";
      return NextResponse.redirect(new URL(ROLE_DASHBOARD[primary], req.nextUrl));
    }
    return NextResponse.next();
  }

  // 2. Защищённые маршруты (/dashboard/*).
  if (isProtectedRoute(pathname)) {
    if (!isLoggedIn) {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    // Fail-closed: отсутствие записи в матрице — запрет (FE-01). Раньше
    // непокрытый маршрут трактовался как «разрешено всем» — эту дыру
    // закрыли запретом по умолчанию.
    const allowed = allowedRolesFor(pathname);
    const userRoles = new Set(session!.user!.roles);
    const ok =
      allowed !== null && allowed.length > 0 && allowed.some((r) => userRoles.has(r));
    if (!ok) {
      // Нет записи или роль не подходит — доступ запрещён.
      return NextResponse.rewrite(new URL("/forbidden", req.nextUrl));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  // Пропускаем через middleware только маршруты, которым нужна проверка.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js).*$).*)"],
};