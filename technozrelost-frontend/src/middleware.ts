import { NextResponse } from "next/server";
import { auth } from "@/auth.config";
import {
  allowedRolesFor,
  isAuthRoute,
  isProtectedRoute,
  ROLE_DASHBOARD,
  type RoleSlug,
} from "@/lib/roles";
import { CLIENT_API_BASE } from "@/lib/public-api";

// FE-05: per-request nonce — Next.js извлекает nonce из CSP 'nonce-{value}' и автоматически проставляет в скрипты;
// CSP header — единственный носитель nonce (SPEC-06 L-01: мёртвый заголовок удалён).
// connect-src оверрайд берём из единого модуля public-api, чтобы не дублировать чтение env в src/ (FE-02 contract).

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${CLIENT_API_BASE ? ` ${CLIENT_API_BASE}` : ""}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function makeNonce(): string {
  const raw = crypto.randomUUID();
  // Buffer доступен в Node-рантайме; fallback на btoa для edge
  if (typeof Buffer !== "undefined" && typeof (Buffer as unknown as { from?: unknown }).from === "function") {
    return Buffer.from(raw).toString("base64");
  }
  return btoa(raw);
}

// FE-06 middleware:39 deny 403 — зона запрета, реальный rewrite с 403 ниже (см. allowed check)

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const nonce = makeNonce();
  const csp = buildCsp(nonce);
  const session = req.auth as unknown as { user?: { roles: string[] }; error?: string } | null;
  const isLoggedIn = !!session?.user;

  function withCsp(response: NextResponse): NextResponse {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  // FE-03: RefreshAccessTokenError → /login только для защищённых/auth-маршрутов.
  // Публичные страницы лендинга (/about, /news, /levels и т.д.) должны оставаться
  // доступны даже с протухшей сессией в куках — иначе пользователь не может
  // открыть сайт без ручной чистки cookies.
  if ((session as { error?: string } | null)?.error === "RefreshAccessTokenError") {
    if (pathname === "/login") {
      const res = NextResponse.next();
      return withCsp(res);
    }
    if (isProtectedRoute(pathname) || isAuthRoute(pathname)) {
      const res = NextResponse.redirect(new URL("/login", req.nextUrl));
      return withCsp(res);
    }
  }

  // 1. Auth-маршруты: залогиненного пользователя отправляем в его кабинет.
  if (isAuthRoute(pathname)) {
    if (isLoggedIn) {
      const primary = (session!.user!.roles[0] as RoleSlug) ?? "gk_customer";
      const res = NextResponse.redirect(new URL(ROLE_DASHBOARD[primary], req.nextUrl));
      return withCsp(res);
    }
    const res = NextResponse.next();
    return withCsp(res);
  }

  // 2. Защищённые маршруты (/dashboard/*).
  if (isProtectedRoute(pathname)) {
    if (!isLoggedIn) {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("callbackUrl", pathname);
      const res = NextResponse.redirect(url);
      return withCsp(res);
    }

    // Fail-closed: отсутствие записи в матрице — запрет (FE-01). Раньше
    // непокрытый маршрут трактовался как «разрешено всем» — эту дыру
    // закрыли запретом по умолчанию.
    const allowed = allowedRolesFor(pathname);
    const userRoles = new Set(session!.user!.roles);
    const ok =
      allowed !== null && allowed.length > 0 && allowed.some((r) => userRoles.has(r));
    if (!ok) {
      // FE-06: deny через 403 (ранее rewrite отдавал 200 и портил мониторинг)
      const res = NextResponse.rewrite(new URL("/forbidden", req.nextUrl), { status: 403 });
      return withCsp(res);
    }
    const res = NextResponse.next();
    return withCsp(res);
  }

  const res = NextResponse.next();
  return withCsp(res);
});

export const config = {
  // Пропускаем через middleware только маршруты, которым нужна проверка.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js).*$).*)"],
};
