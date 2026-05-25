FROM node:20-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache python3 make g++ && npm install -g pnpm@9 --quiet

# Flat node_modules so @prisma/client resolves the custom output path correctly
RUN echo "node-linker=hoisted" > .npmrc

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/wa-server/package.json ./packages/wa-server/
COPY packages/dashboard-api/package.json ./packages/dashboard-api/
COPY packages/dashboard-ui/package.json ./packages/dashboard-ui/
# Copy prisma schema early so postinstall (prisma generate) succeeds
COPY packages/dashboard-api/prisma/schema.prisma ./packages/dashboard-api/prisma/schema.prisma

RUN pnpm install --frozen-lockfile --filter @wasphere/dashboard-api...

COPY packages/dashboard-api/src ./packages/dashboard-api/src
COPY packages/dashboard-api/tsconfig.json ./packages/dashboard-api/tsconfig.json
COPY packages/dashboard-api/prisma ./packages/dashboard-api/prisma
RUN pnpm --filter @wasphere/dashboard-api build

RUN pnpm deploy --filter @wasphere/dashboard-api --prod /deploy

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget && npm install -g pnpm@9 prisma@6 --quiet

COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /repo/packages/dashboard-api/dist ./dist
COPY --from=builder /deploy/package.json ./package.json
COPY packages/dashboard-api/prisma ./prisma
COPY packages/dashboard-api/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
