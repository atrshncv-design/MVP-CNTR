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
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "run", "start"]
