# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the Next.js dashboard into a static export (frontend/out)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — the Laravel app, serving the compiled frontend from public/
# ---------------------------------------------------------------------------
FROM php:8.3-cli AS backend

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libpng-dev libonig-dev libxml2-dev sqlite3 libsqlite3-dev \
    && docker-php-ext-install pdo pdo_mysql pdo_sqlite mbstring zip bcmath \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP deps first so this layer is cached while app code changes.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader

# App code.
COPY . .

# Laravel's own public/ assets are tracked in git; drop in the compiled
# Next.js static export next to them (build-frontend.ps1 does this locally).
COPY --from=frontend-build /app/frontend/out/. ./public/

RUN composer dump-autoload --optimize \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache database \
    && chmod -R 775 storage bootstrap/cache

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 10000
ENTRYPOINT ["docker-entrypoint.sh"]
