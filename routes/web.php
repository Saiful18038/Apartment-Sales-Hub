<?php

use Illuminate\Support\Facades\Route;

// The Next.js dashboard is compiled to a static export and copied into
// public/ by build-frontend.ps1. The API still lives at /api/* (routes/api.php).
//
// PHP's built-in server (php artisan serve) and Apache both serve any real
// file in public/ directly (JS/CSS bundles, images, /login/index.html, ...).
// This catch-all only runs for paths with no matching file — the SPA's
// client-side routes — and hands back the pre-rendered HTML for that route,
// falling back to the app shell so deep links and refreshes work.
Route::get('/{path?}', function (string $path = '') {
    $public = public_path();

    if ($path !== '' && ! str_contains($path, '..')) {
        foreach (["{$path}/index.html", "{$path}.html", $path] as $relative) {
            $candidate = realpath($public.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relative));

            if ($candidate !== false
                && is_file($candidate)
                && str_starts_with($candidate, $public.DIRECTORY_SEPARATOR)) {
                return response()->file($candidate);
            }
        }
    }

    $shell = $public.DIRECTORY_SEPARATOR.'index.html';

    abort_unless(is_file($shell), 404, 'Frontend not built. Run build-frontend.ps1.');

    return response()->file($shell);
})->where('path', '^(?!api($|/))(?!up$).*$');
