FROM node:20-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache git python3 make g++ && npm install -g pnpm@9 --quiet

# Flat node_modules so peer deps (express, etc.) resolve correctly after pnpm deploy
RUN echo "node-linker=hoisted" > .npmrc

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/wa-server/package.json ./packages/wa-server/
COPY packages/dashboard-api/package.json ./packages/dashboard-api/
COPY packages/dashboard-ui/package.json ./packages/dashboard-ui/
# Copy prisma schema early so dashboard-api postinstall (prisma generate) succeeds
COPY packages/dashboard-api/prisma/schema.prisma ./packages/dashboard-api/prisma/schema.prisma

RUN pnpm install --frozen-lockfile --filter @wasphere/wa-server...

COPY packages/wa-server ./packages/wa-server
RUN pnpm --filter @wasphere/wa-server build

RUN pnpm deploy --filter @wasphere/wa-server --prod /deploy

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /repo/packages/wa-server/dist ./dist
COPY --from=builder /deploy/package.json ./package.json

EXPOSE 3001
CMD ["node", "dist/main.js"]
