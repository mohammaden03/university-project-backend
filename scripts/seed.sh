#!/usr/bin/env bash
# Database Seed Runner for Manuscript AI
set -euo pipefail

echo "Running Prisma migrations and seeding..."
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
echo "Seeding completed successfully."
