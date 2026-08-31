<?php

/**
 * Laravel - A PHP Framework For Web Artisans
 *
 * Router script for PHP's built-in server (`php -S host:port server.php`).
 * Used in Docker instead of `php artisan serve`, which spawns the actual
 * server as a subprocess that doesn't reliably inherit the container's
 * environment variables (APP_KEY, DB_*, ...) — running this file directly
 * as the server process itself avoids that indirection entirely.
 */

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)
);

// Emulate Apache's "mod_rewrite": serve real files (JS/CSS bundles, images,
// the Next.js export, ...) as-is, and hand everything else to Laravel.
if ($uri !== '/' && file_exists(__DIR__.'/public'.$uri)) {
    return false;
}

require_once __DIR__.'/public/index.php';
