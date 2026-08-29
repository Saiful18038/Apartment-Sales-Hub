<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Regression test — a request to /api/* with no "Accept: application/json"
 * header (a bare curl call, or a browser tab hitting the URL directly) used
 * to crash with a 500 RouteNotFoundException ("Route [login] not defined")
 * instead of a clean 401/404, because this backend has no web login route
 * and Laravel's framework default tries to redirect guests there. Fixed via
 * redirectGuestsTo()/shouldRenderJsonWhen() in bootstrap/app.php.
 */
class ApiErrorFormatTest extends TestCase
{
    public function test_unauthenticated_api_request_without_accept_header_returns_clean_401(): void
    {
        $response = $this->call('GET', '/api/flats');

        $response->assertStatus(401);
        $response->assertHeader('Content-Type', 'application/json');
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    public function test_unknown_api_route_without_accept_header_returns_json_404(): void
    {
        $response = $this->call('GET', '/api/this-route-does-not-exist');

        $response->assertStatus(404);
        $response->assertHeader('Content-Type', 'application/json');
    }
}
