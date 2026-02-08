#!/bin/bash

# AI Debates - Deployment Script
# This script pulls the latest code and restarts containers

echo "🚀 Starting deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# 2. Rebuild and restart containers
echo "🏗️ Building and starting containers..."
docker-compose up -d --build

# 3. Database migrations
echo "🗄️ Running database migrations..."
docker-compose exec -T api alembic upgrade head

# 4. Clean up old images
echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "✅ Deployment complete! Check your domain in a few minutes after SSL is issued."
