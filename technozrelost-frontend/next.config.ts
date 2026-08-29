import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const internalApiUrl = process.env.API_URL_INTERNAL?.trim().replace(/\/+$/, "");

if (!isDev && !internalApiUrl) {
  throw new Error(
    "API_URL_INTERNAL не задан: production-конфигурации нужен явный внутренний адрес бэкенда.",
  );
}

const rewriteApiUrl = internalApiUrl || (isDev ? "http://127.0.0.1:8000" : "");
// FE-05 nonce: script-src 'self' 'nonce-{NONCE}' — middleware injects nonce per-request
// Клиентские вызовы идут по относительному /api/v1 того же origin
// (единый модуль src/lib/public-api.ts), поэтому CSP достаточно 'self'.
// NEXT_PUBLIC_API_URL — опциональный оверрайд адреса API: если он задан,
// разрешаем и его (единственный источник внешнего хоста в connect-src).
const publicApiOverride = process.env.NEXT_PUBLIC_API_URL?.trim();

// FE-05: nonce-based CSP — script-src с nonce и strict-dynamic (FE-06: form-action 'self' + upgrade-insecure-requests)
// 'unsafe-inline' удалён из политики — заменён nonce
function buildCsp(nonce?: string): string {
  // В dev 'unsafe-eval' нужен react-refresh, в prod — нет. 'strict-dynamic' позволяет
  // скриптам с валидным nonce подгружать дочерние чанки без перечисления хостов.
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} 'strict-dynamic'`
    : `script-src 'self'${isDev ? " 'unsafe-eval'" : ""} 'strict-dynamic'`;
  return [
    "default-src 'self'",
    scriptSrc, // FE-06 CSP form-action 'self' + upgrade-insecure-requests (зона next.config:28)
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${publicApiOverride ? ` ${publicApiOverride}` : ""}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// Базовый CSP без nonce — для headers() fallback (статические ассеты и ранний ответ до middleware);
// per-request nonce для HTML-документов инжектит middleware (FE-05) и переопределяет этот заголовок.
const contentSecurityPolicy = buildCsp();

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Публичная демо-ссылка с локальной машины: один туннель на сайт,
  // а все запросы /api/v1/* проксируются на внутренний адрес FastAPI.
  // В dev допустим локальный адрес прокси; production требует API_URL_INTERNAL.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${rewriteApiUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
export { buildCsp };
