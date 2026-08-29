<?php

namespace Tests\Feature;

use App\Models\AssetStatus;
use App\Models\Customer;
use App\Models\Project;
use App\Models\Sale;
use App\Models\User;
use App\Models\Zone;
use App\Notifications\FollowUpReminder;
use App\Notifications\PaymentDueReminder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Roadmap Phase 19 — Notification System.
 */
class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_a_booking_notifies_the_employee_and_all_managers(): void
    {
        AssetStatus::create(['code' => 'AVAILABLE', 'label' => 'Available', 'fill_color' => '#fff', 'border_color' => '#ccc', 'text_color' => '#000']);
        AssetStatus::create(['code' => 'ASSET_BOOKED', 'label' => 'Asset Booked', 'fill_color' => '#fff', 'border_color' => '#ccc', 'text_color' => '#000']);
        $zone = Zone::create(['name' => 'Z1']);
        $project = Project::create(['zone_id' => $zone->id, 'type' => 'regular', 'name' => 'P1', 'status' => 'Ongoing']);
        $flat = \App\Models\Flat::create(['project_id' => $project->id, 'floor' => 1, 'flat_no' => 'F-1', 'status_code' => 'AVAILABLE']);
        $customer = Customer::create(['name' => 'Cust']);
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@test.com', 'password' => 'password', 'role' => 'owner']);
        $rahim = User::create(['name' => 'Rahim', 'email' => 'rahim@test.com', 'password' => 'password', 'role' => 'employee']);

        $token = $rahim->createToken('api')->plainTextToken;
        $this->withHeader('Authorization', "Bearer $token")->postJson('/api/bookings', [
            'flat_id' => $flat->id, 'customer_id' => $customer->id, 'amount' => 100000, 'date' => now()->toDateString(),
        ])->assertCreated();

        $this->assertCount(1, $owner->fresh()->notifications);
        $this->assertCount(1, $rahim->fresh()->notifications);
        $this->assertSame('Booking Confirmed', $rahim->fresh()->notifications->first()->data['title']);
    }

    public function test_mark_read_and_unread_count(): void
    {
        $user = User::create(['name' => 'Owner', 'email' => 'owner@test.com', 'password' => 'password', 'role' => 'owner']);
        $zone = Zone::create(['name' => 'Z1']);
        AssetStatus::create(['code' => 'AVAILABLE', 'label' => 'Available', 'fill_color' => '#fff', 'border_color' => '#ccc', 'text_color' => '#000']);
        $project = Project::create(['zone_id' => $zone->id, 'type' => 'regular', 'name' => 'P1', 'status' => 'Ongoing']);
        $customer = Customer::create(['name' => 'Cust', 'follow_up_date' => now()->toDateString()]);
        $user->notify(new FollowUpReminder($customer));

        $token = $user->createToken('api')->plainTextToken;

        $unread = $this->withHeader('Authorization', "Bearer $token")->getJson('/api/notifications/unread-count');
        $unread->assertJson(['count' => 1]);

        $list = $this->withHeader('Authorization', "Bearer $token")->getJson('/api/notifications');
        $id = $list->json('0.id');

        $this->withHeader('Authorization', "Bearer $token")->postJson("/api/notifications/{$id}/read")->assertOk();

        $this->withHeader('Authorization', "Bearer $token")->getJson('/api/notifications/unread-count')
            ->assertJson(['count' => 0]);
    }

    public function test_payment_due_reminder_command_only_notifies_sales_with_a_balance(): void
    {
        AssetStatus::create(['code' => 'SOLD_CR', 'label' => 'Sold', 'fill_color' => '#fff', 'border_color' => '#ccc', 'text_color' => '#000']);
        $zone = Zone::create(['name' => 'Z1']);
        $project = Project::create(['zone_id' => $zone->id, 'type' => 'regular', 'name' => 'P1', 'status' => 'Ongoing']);
        $flat = \App\Models\Flat::create(['project_id' => $project->id, 'floor' => 1, 'flat_no' => 'F-1', 'status_code' => 'SOLD_CR']);
        $customer = Customer::create(['name' => 'Cust']);
        $owner = User::create(['name' => 'Owner', 'email' => 'owner@test.com', 'password' => 'password', 'role' => 'owner']);
        $rahim = User::create(['name' => 'Rahim', 'email' => 'rahim@test.com', 'password' => 'password', 'role' => 'employee']);

        Sale::create([
            'flat_id' => $flat->id, 'customer_id' => $customer->id, 'employee_id' => $rahim->id,
            'sale_price' => 1000000, 'sale_type' => 'SOLD_CR', 'date' => now()->toDateString(), 'status' => 'confirmed',
        ]);

        Artisan::call('app:send-payment-due-reminders');

        $this->assertCount(1, $rahim->fresh()->notifications);
        $this->assertCount(1, $owner->fresh()->notifications);
        $this->assertSame(PaymentDueReminder::class, $rahim->fresh()->notifications->first()->type);
    }
}
