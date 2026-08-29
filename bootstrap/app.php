<?php

use App\Http\Middleware\CheckLicense;
use App\Http\Middleware\CheckRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => CheckRole::class,
            // Roadmap Part B / Stage 16-20 — license-check hook, wired in
            // from day one so every future licensing feature just plugs
            // into App\Services\LicenseService without touching routes.
            'license' => CheckLicense::class,
        ]);

        // This backend is API-only and has no web "login" route. Laravel's
        // framework default (ApplicationBuilder::withMiddleware) redirects
        // every unauthenticated guest to route('login') unconditionally,
        // which doesn't exist here and crashes with a 500
        // RouteNotFoundException instead of a clean 401. Returning null
        // disables the redirect so an unauthenticated request always just
        // gets the JSON 401 from AuthenticationException.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Paired with redirectGuestsTo() above: forces every /api/* error
        // (401, 404, validation, etc.) to render as JSON even when the
        // request has no explicit "Accept: application/json" header (a
        // bare curl call, a browser tab, ...).
        $exceptions->shouldRenderJsonWhen(fn ($request, $e) => $request->is('api/*') || $request->expectsJson());
    })->create();
