# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3010

COPY package.json package-lock.json ./
COPY shared ./shared
COPY server/package.json ./server/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/public ./server/public
COPY --from=build /app/server/db ./server/db

WORKDIR /app/server
EXPOSE 3010
# Env vía Compose / runtime (DATABASE_URL, JWT_SECRET, …)
CMD ["node", "dist/src/index.js"]
