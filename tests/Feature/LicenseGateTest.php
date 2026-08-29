<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Roadmap Part E — License Testing ("সবচেয়ে গুরুত্বপূর্ণ" / most important).
 * Exercises the CheckLicense middleware placeholder end-to-end via the
 * LICENSE_SIMULATED_STATUS config value, without needing the real License
 * Server (Part B) to exist yet.
 */
class LicenseGateTest extends TestCase
{
    use RefreshDatabase;

    private function actingUser(): User
    {
        return User::create([
            'name' => 'Owner', 'email' => 'owner@test.com', 'password' => 'password', 'role' => 'owner',
        ]);
    }

    public function test_active_license_allows_access(): void
    {
        config(['license.simulated_status' => 'ACTIVE']);
        $token = $this->actingUser()->createToken('api')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")->getJson('/api/zones');

        $response->assertOk();
        $response->assertHeader('X-License-Status', 'ACTIVE');
    }

    public function test_grace_period_allows_access_with_warning_header(): void
    {
        config(['license.simulated_status' => 'GRACE']);
        $token = $this->actingUser()->createToken('api')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")->getJson('/api/zones');

        $response->assertOk();
        $response->assertHeader('X-License-Status', 'GRACE');
    }

    #[DataProvider('blockingStatuses')]
    public function test_blocking_statuses_restrict_the_whole_api($status): void
    {
        config(['license.simulated_status' => $status]);
        $token = $this->actingUser()->createToken('api')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")->getJson('/api/zones');

        $response->assertStatus(403);
        $response->assertJson(['error' => "LICENSE_$status"]);
    }

    public static function blockingStatuses(): array
    {
        return [['EXPIRED'], ['SUSPENDED'], ['REVOKED']];
    }
}
