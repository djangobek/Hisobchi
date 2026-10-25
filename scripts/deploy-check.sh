#!/usr/bin/env bash
set -Eeuo pipefail
echo "[1/5] Validate Prisma schema"
npx prisma validate
echo "[2/5] Generate Prisma client"
npx prisma generate
echo "[3/5] Apply committed migrations"
npx prisma migrate deploy
echo "[4/5] TypeScript check"
npm run typecheck
echo "[5/5] Unit tests"
npm test
echo "Checks passed. Run npm run build before production deployment."
