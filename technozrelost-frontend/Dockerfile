# Production image: technozrelost-frontend (Next.js 16)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Ограничаем heap Node: next build не должен убиваться OOM-killer'ом
# на машинах с небольшой VM (Docker Desktop 4–8 ГБ).
ENV NODE_OPTIONS=--max-old-space-size=2048
# Пустое значение означает same-origin; полный origin задаётся только для
# нестандартной схемы развёртывания и подставляется на этапе сборки.
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Нужен только при вычислении production rewrite; в runner image не переносится.
ARG API_URL_INTERNAL
ENV API_URL_INTERNAL=$API_URL_INTERNAL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
# T13: runtime user is created and writable cache paths are owned at build time.
ARG APP_UID=10001
ARG APP_GID=10001
RUN addgroup -S -g "${APP_GID}" app \
    && adduser -S -D -H -u "${APP_UID}" -G app app \
    && mkdir -p /home/app /app/.next/cache \
    && chown -R app:app /home/app /app/.next/cache
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/tmp
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
RUN chown -R app:app /app
USER app:app
EXPOSE 3000
CMD ["npm", "run", "start"]
