<?php

namespace Tests\Feature;

use App\Models\AssetStatus;
use App\Models\Customer;
use App\Models\Flat;
use App\Models\Project;
use App\Models\Sale;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/**
 * Roadmap Phase 11 — Employee Privacy (Row-Level Security), Part E test plan.
 * An employee must never receive another employee's confidential sale data
 * over the wire, not just have it hidden client-side.
 */
class EmployeePrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_cannot_see_another_employees_sale_detail_on_a_flat(): void
    {
        AssetStatus::create(['code' => 'SOLD_CR', 'label' => 'Sold (CR)', 'fill_color' => '#FFE699', 'border_color' => '#D8B84A', 'text_color' => '#5C4A08', 'is_sellable' => false]);
        AssetStatus::create(['code' => 'AVAILABLE', 'label' => 'Available', 'fill_color' => '#FFFFFF', 'border_color' => '#CBD5E1', 'text_color' => '#334155', 'is_sellable' => true]);

        $zone = Zone::create(['name' => 'TestZone']);
        $project = Project::create(['zone_id' => $zone->id, 'type' => 'regular', 'name' => 'Test Project', 'status' => 'Ongoing']);
        $flat = Flat::create(['project_id' => $project->id, 'floor' => 1, 'flat_no' => 'F-1', 'status_code' => 'SOLD_CR']);

        $rahim = User::create(['name' => 'Rahim', 'email' => 'rahim@test.com', 'password' => 'password', 'role' => 'employee']);
        $karim = User::create(['name' => 'Karim', 'email' => 'karim@test.com', 'password' => 'password', 'role' => 'employee']);

        $customer = Customer::create(['name' => 'A Customer', 'assigned_employee_id' => $rahim->id]);
        Sale::create([
            'flat_id' => $flat->id, 'customer_id' => $customer->id, 'employee_id' => $rahim->id,
            'sale_price' => 1000000, 'sale_type' => 'SOLD_CR', 'date' => now()->toDateString(), 'status' => 'confirmed',
        ]);

        // Karim (a different employee) must NOT see who sold it / to whom / for how much.
        $karimToken = $karim->createToken('api')->plainTextToken;
        $karimResponse = $this->withHeader('Authorization', "Bearer $karimToken")->getJson("/api/flats/{$flat->id}");
        $karimResponse->assertOk();
        $karimResponse->assertJsonPath('data.sale', null);

        // Sanctum's guard caches the resolved user on first Auth::user() call;
        // reset it so the next request re-authenticates against its own token
        // instead of reusing Karim's from the previous simulated request.
        Auth::forgetGuards();

        // Rahim (the actual seller) SHOULD see the full sale detail.
        $rahimToken = $rahim->createToken('api')->plainTextToken;
        $rahimResponse = $this->withHeader('Authorization', "Bearer $rahimToken")->getJson("/api/flats/{$flat->id}");
        $rahimResponse->assertOk();
        $rahimResponse->assertJsonPath('data.sale.sold_by', 'Rahim');

        Auth::forgetGuards();

        // Owner/Admin should always see full detail regardless of who sold it.
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@test.com', 'password' => 'password', 'role' => 'owner']);
        $ownerToken = $owner->createToken('api')->plainTextToken;
        $ownerResponse = $this->withHeader('Authorization', "Bearer $ownerToken")->getJson("/api/flats/{$flat->id}");
        $ownerResponse->assertJsonPath('data.sale.sold_by', 'Rahim');
    }

    public function test_employee_sales_list_is_scoped_to_their_own_rows(): void
    {
        AssetStatus::create(['code' => 'AVAILABLE', 'label' => 'Available', 'fill_color' => '#FFFFFF', 'border_color' => '#CBD5E1', 'text_color' => '#334155', 'is_sellable' => true]);

        $zone = Zone::create(['name' => 'TestZone']);
        $project = Project::create(['zone_id' => $zone->id, 'type' => 'regular', 'name' => 'Test Project', 'status' => 'Ongoing']);
        $flat1 = Flat::create(['project_id' => $project->id, 'floor' => 1, 'flat_no' => 'F-1', 'status_code' => 'AVAILABLE']);
        $flat2 = Flat::create(['project_id' => $project->id, 'floor' => 2, 'flat_no' => 'F-2', 'status_code' => 'AVAILABLE']);

        $rahim = User::create(['name' => 'Rahim', 'email' => 'rahim@test.com', 'password' => 'password', 'role' => 'employee']);
        $karim = User::create(['name' => 'Karim', 'email' => 'karim@test.com', 'password' => 'password', 'role' => 'employee']);

        $c1 = Customer::create(['name' => 'Customer One', 'assigned_employee_id' => $rahim->id]);
        $c2 = Customer::create(['name' => 'Customer Two', 'assigned_employee_id' => $karim->id]);

        Sale::create(['flat_id' => $flat1->id, 'customer_id' => $c1->id, 'employee_id' => $rahim->id, 'sale_price' => 500000, 'sale_type' => 'SOLD_CR', 'date' => now()->toDateString(), 'status' => 'confirmed']);
        Sale::create(['flat_id' => $flat2->id, 'customer_id' => $c2->id, 'employee_id' => $karim->id, 'sale_price' => 700000, 'sale_type' => 'SOLD_CR', 'date' => now()->toDateString(), 'status' => 'confirmed']);

        $rahimToken = $rahim->createToken('api')->plainTextToken;
        $response = $this->withHeader('Authorization', "Bearer $rahimToken")->getJson('/api/sales');

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.employee_id', $rahim->id);
    }
}
