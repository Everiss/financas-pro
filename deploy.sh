#!/bin/bash
# ─── deploy.sh — executa na VPS ───────────────────────────────────────────────
set -e

echo "==> Atualizando código..."
git pull origin main

echo "==> Reconstruindo e subindo containers..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "==> Limpando imagens antigas..."
docker image prune -f

echo "==> Deploy concluído!"
docker compose -f docker-compose.prod.yml ps
