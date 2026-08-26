import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Клиентские вызовы идут по относительному /api/v1 того же origin
// (единый модуль src/lib/public-api.ts), поэтому CSP достаточно 'self'.
// NEXT_PUBLIC_API_URL — опциональный оверрайд адреса API: если он задан,
// разрешаем и его (единственный источник внешнего хоста в connect-src).
const publicApiOverride = process.env.NEXT_PUBLIC_API_URL?.trim();

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' нужен bootstrap-скриптам Next.js App Router;
  // 'unsafe-eval' — только dev (react-refresh).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${publicApiOverride ? ` ${publicApiOverride}` : ""}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

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
  // Адрес прокси — единственное место вне src/lib/public-api.ts с явным
  // дефолтом: это конфигурация серверного прокси, она никогда не попадает
  // в клиентский бандл (прод берёт адрес из API_URL_INTERNAL).
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_URL_INTERNAL ?? "http://127.0.0.1:8000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
