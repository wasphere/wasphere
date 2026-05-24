#!/bin/sh
set -e
echo "[entrypoint] Generating Prisma client..."
prisma generate
echo "[entrypoint] Running Prisma migrations..."
prisma migrate deploy
echo "[entrypoint] Starting dashboard-api..."
exec node dist/main.js
