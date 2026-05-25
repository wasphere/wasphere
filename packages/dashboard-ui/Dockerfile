FROM node:20-alpine AS builder
WORKDIR /repo
RUN npm install -g pnpm@9 --quiet

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/wa-server/package.json ./packages/wa-server/
COPY packages/dashboard-api/package.json ./packages/dashboard-api/
COPY packages/dashboard-ui/package.json ./packages/dashboard-ui/
# Copy prisma schema early so dashboard-api postinstall (prisma generate) succeeds
COPY packages/dashboard-api/prisma/schema.prisma ./packages/dashboard-api/prisma/schema.prisma

RUN pnpm install --frozen-lockfile --filter dashboard-ui...

ARG REBUILD_EPOCH=1
COPY packages/dashboard-ui ./packages/dashboard-ui
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter dashboard-ui build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone output preserves monorepo path structure
COPY --from=builder /repo/packages/dashboard-ui/.next/standalone ./
COPY --from=builder /repo/packages/dashboard-ui/.next/static \
     ./packages/dashboard-ui/.next/static
COPY --from=builder /repo/packages/dashboard-ui/public \
     ./packages/dashboard-ui/public

EXPOSE 3004
ENV PORT=3004
ENV HOSTNAME=0.0.0.0
# Run from /app so node finds server.js whether Next.js places it at the
# standalone root (monorepo workspace mode) or inside packages/dashboard-ui/
WORKDIR /app
CMD ["sh", "-c", "node $([ -f packages/dashboard-ui/server.js ] && echo packages/dashboard-ui/server.js || echo server.js)"]
