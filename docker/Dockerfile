# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/order-service/package.json packages/order-service/package.json
COPY packages/inventory-service/package.json packages/inventory-service/package.json
COPY packages/notification-service/package.json packages/notification-service/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG SERVICE
COPY . .
RUN pnpm --filter @ms/shared build && pnpm --filter "@ms/${SERVICE}" build

FROM node:22-alpine AS runtime
RUN corepack enable
ARG SERVICE
ENV NODE_ENV=production
ENV SERVICE=${SERVICE}
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/${SERVICE} ./packages/${SERVICE}
WORKDIR /app/packages/${SERVICE}
CMD ["node", "dist/index.js"]
