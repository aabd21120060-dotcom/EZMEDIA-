# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

# ============================================================
# STAGE 1 — BASE
# ============================================================

FROM node:${NODE_VERSION}-bookworm-slim AS base

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

# ============================================================
# STAGE 2 — DEPENDENCIES
# ============================================================

FROM base AS dependencies

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY apps/api/package.json ./apps/api/package.json

COPY packages/config/package.json ./packages/config/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/events/package.json ./packages/events/package.json
COPY packages/logging/package.json ./packages/logging/package.json
COPY packages/observability/package.json ./packages/observability/package.json
COPY packages/security/package.json ./packages/security/package.json
COPY packages/storage/package.json ./packages/storage/package.json

RUN pnpm install --frozen-lockfile

# ============================================================
# STAGE 3 — BUILD
# ============================================================

FROM dependencies AS build

COPY tsconfig.base.json tsconfig.json ./

COPY apps ./apps
COPY packages ./packages
COPY database ./database

RUN pnpm typecheck

RUN pnpm build

# ============================================================
# STAGE 4 — PRODUCTION DEPENDENCIES
# ============================================================

FROM base AS production-dependencies

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

COPY apps/api/package.json ./apps/api/package.json

COPY packages/config/package.json ./packages/config/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/events/package.json ./packages/events/package.json
COPY packages/logging/package.json ./packages/logging/package.json
COPY packages/observability/package.json ./packages/observability/package.json
COPY packages/security/package.json ./packages/security/package.json
COPY packages/storage/package.json ./packages/storage/package.json

RUN pnpm install --frozen-lockfile --prod

# ============================================================
# STAGE 5 — RUNTIME
# ============================================================

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN groupadd --system --gid 1001 ezmedia \
    && useradd --system \
       --uid 1001 \
       --gid 1001 \
       --create-home \
       --shell /usr/sbin/nologin \
       ezmedia

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

COPY --from=base /usr/local/bin/corepack /usr/local/bin/corepack

COPY --from=production-dependencies \
    /app/node_modules \
    ./node_modules

COPY --from=production-dependencies \
    /app/apps/api/node_modules \
    ./apps/api/node_modules

COPY --from=production-dependencies \
    /app/packages \
    ./packages

COPY --from=build \
    /app/apps/api/dist \
    ./apps/api/dist

COPY --from=build \
    /app/packages \
    ./packages

COPY --from=build \
    /app/database \
    ./database

COPY package.json pnpm-workspace.yaml ./

RUN chown -R ezmedia:ezmedia /app

USER ezmedia

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=20s \
    --retries=3 \
    CMD node -e "\
      fetch('http://127.0.0.1:3000/health/live')\
        .then(r => process.exit(r.ok ? 0 : 1))\
        .catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
