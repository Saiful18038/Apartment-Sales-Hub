#!/bin/sh
# Self-configures the container on first boot so the image runs anywhere
# (Render, another host, a plain `docker run`) with zero manual setup.
set -e

cd /var/www/html

if [ ! -f .env ]; then
    cp .env.example .env
fi

# Default to a bundled SQLite database unless the platform sets DB_* env
# vars (e.g. to point at a managed MySQL/Postgres instance) for real
# persistent storage. Render's free web services have an ephemeral
# filesystem, so SQLite data does not survive a redeploy/cold start —
# fine for a demo, not for production data you need to keep.
if [ -z "$DB_CONNECTION" ] || [ "$DB_CONNECTION" = "sqlite" ]; then
    export DB_CONNECTION=sqlite
    export DB_DATABASE=/var/www/html/database/database.sqlite
    touch "$DB_DATABASE"
fi

php artisan config:clear >/dev/null

if ! grep -q '^APP_KEY=base64' .env 2>/dev/null && [ -z "$APP_KEY" ]; then
    php artisan key:generate --force
fi

php artisan migrate --force --seed

php artisan storage:link >/dev/null 2>&1 || true

exec php artisan serve --host=0.0.0.0 --port="${PORT:-10000}"
