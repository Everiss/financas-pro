#!/bin/bash
# deploy.sh — Executa na instância EC2 após o push das imagens para o ECR
set -e

echo "==> Fazendo login no ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

echo "==> Baixando imagens mais recentes..."
docker compose -f docker-compose.prod.yml pull

echo "==> Subindo containers..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo "==> Removendo imagens antigas..."
docker image prune -f

echo "==> Deploy concluído!"
docker compose -f docker-compose.prod.yml ps
