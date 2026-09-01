#!/usr/bin/env bash
# AI Debates - deployment script: pull latest code and rebuild containers.
set -euo pipefail
cd "$(dirname "$0")"

echo "🚀 Starting deployment..."

echo "📥 Pulling latest code from GitHub..."
git pull --ff-only origin main

echo "🏗️  Building and starting containers (migrations run on api start)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

echo "🩺 Container status:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "✅ Deployment complete."
