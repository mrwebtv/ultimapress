# UltimaPress image. Built by GitHub Actions (ghcr.io/mrwebtv/ultimapress) or locally.
# The build never touches a database: pages render on first visit, then stay cached.
# On start the container creates its secrets and applies database migrations.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    UP_SKIP_STATIC=1 \
    NODE_OPTIONS=--no-deprecation \
    DATABASE_URL=postgres://build:build@127.0.0.1:1/build \
    PAYLOAD_SECRET=build-only-secret \
    NEXT_PUBLIC_SERVER_URL=http://localhost
RUN pnpm exec next build --experimental-build-mode compile

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--no-deprecation \
    MEDIA_DIR=/app/media \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# For Build > Site code: database backups before an update, and packing/unpacking the code.
RUN apk add --no-cache postgresql17-client zip unzip
COPY --from=builder /app ./
RUN mkdir -p /app/media /app/data
EXPOSE 3000
CMD ["sh", "/app/docker/entrypoint.sh"]
