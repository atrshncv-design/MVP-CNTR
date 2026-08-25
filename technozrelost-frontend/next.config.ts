import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Клиентские компоненты ходят в бэкенд напрямую по NEXT_PUBLIC_API_URL
// (или fallback 127.0.0.1:8000 в dev) — CSP connect-src должен их пускать.
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' нужен bootstrap-скриптам Next.js App Router;
  // 'unsafe-eval' — только dev (react-refresh).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`,
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
  // а все запросы /api/v1/* проксируются на локальный FastAPI (127.0.0.1:8000).
  // Это убирает зависимость браузера клиента от внешнего адреса API и CORS.
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
