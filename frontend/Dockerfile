# Build stage
FROM node:20-alpine as build-stage

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM caddy:2-alpine

# Copy built assets
COPY --from=build-stage /app/dist /srv

# Copy Caddyfile (we will create this in the root or frontend folder)
# For now, let's assume we copy it from the frontend directory
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
EXPOSE 443
