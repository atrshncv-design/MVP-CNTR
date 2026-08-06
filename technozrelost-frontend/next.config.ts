import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
