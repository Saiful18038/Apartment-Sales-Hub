<?php

namespace Database\Seeders;

use App\Models\ActivityLog;
use App\Models\AssetStatus;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Flat;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Sale;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Database\Seeder;

/**
 * Mirrors buildSeed() in the React prototype (RealEstateERP.jsx) so both
 * the API and the frontend demo show the exact same starting data.
 * All demo users share the password: password
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // ---- 1. Colour status system — single source of truth (Roadmap Phase 6) ----
        $statuses = [
            ['code' => 'AVAILABLE',    'label' => 'Available',       'fill_color' => '#FFFFFF', 'border_color' => '#CBD5E1', 'text_color' => '#334155', 'is_sellable' => true],
            ['code' => 'LAND_OWNER',   'label' => 'Land Owner',      'fill_color' => '#C6E0B4', 'border_color' => '#8FAE7C', 'text_color' => '#284616', 'is_sellable' => false],
            ['code' => 'SOLD_CR',      'label' => 'Sold (CR)',       'fill_color' => '#FFE699', 'border_color' => '#D8B84A', 'text_color' => '#5C4A08', 'is_sellable' => false],
            ['code' => 'SOLD_OS_SS',   'label' => 'Sold (OS/SS)',    'fill_color' => '#BDD7EE', 'border_color' => '#6FA8DC', 'text_color' => '#1B4A6B', 'is_sellable' => false],
            ['code' => 'RESALE_RR',    'label' => 'Re-Sale (RR)',    'fill_color' => '#F4C7DE', 'border_color' => '#D888AE', 'text_color' => '#7A1E48', 'is_sellable' => true],
            ['code' => 'ASSET_BOOKED', 'label' => 'Asset Booked',    'fill_color' => '#FBD5A5', 'border_color' => '#E0A458', 'text_color' => '#6B3E07', 'is_sellable' => false],
            ['code' => 'READY',        'label' => 'Ready Apartment', 'fill_color' => '#FFFFFF', 'border_color' => '#DC2626', 'text_color' => '#DC2626', 'is_sellable' => true],
        ];
        foreach ($statuses as $s) {
            AssetStatus::updateOrCreate(['code' => $s['code']], $s);
        }

        // ---- 2. Users ----
        $owner = User::create(['name' => 'Kamal Hossain', 'email' => 'owner@company.com', 'password' => 'password', 'role' => 'owner', 'department' => 'Management']);
        $admin = User::create(['name' => 'Nasrin Akter', 'email' => 'admin@company.com', 'password' => 'password', 'role' => 'admin', 'department' => 'Operations']);
        $rahim = User::create(['name' => 'Rahim Uddin', 'email' => 'rahim@company.com', 'password' => 'password', 'role' => 'employee', 'employee_code' => 'EMP-023', 'department' => 'Sales']);
        $karim = User::create(['name' => 'Karim Sheikh', 'email' => 'karim@company.com', 'password' => 'password', 'role' => 'employee', 'employee_code' => 'EMP-045', 'department' => 'Sales']);

        // ---- 3. Zones & Projects ----
        $bashundhara = Zone::create(['name' => 'Bashundhara']);
        $uttara = Zone::create(['name' => 'Uttara']);

        $blueHaven = Project::create(['zone_id' => $bashundhara->id, 'type' => 'regular', 'name' => 'BLUEHAVEN', 'code' => 'A-2241', 'address' => 'P-1187 & 1188, R-55, B-L', 'road_facing' => 'S-Rd', 'land_katha' => 6.0, 'total_floors' => 9, 'status' => 'Ongoing', 'handover' => 'Nov-28', 'launch_date' => 'Jan-25']);
        $springAura = Project::create(['zone_id' => $bashundhara->id, 'type' => 'regular', 'name' => 'SPRING AURA', 'code' => 'A', 'address' => 'P-2589, R-4, B-L', 'road_facing' => 'N-Rd', 'land_katha' => 5.0, 'total_floors' => 9, 'status' => 'Ongoing', 'handover' => 'Dec-28', 'launch_date' => 'Mar-25']);
        $nordica = Project::create(['zone_id' => $bashundhara->id, 'type' => 'regular', 'name' => 'NORDICA', 'code' => 'A-1808', 'address' => 'P-2643, R-2, B-L', 'road_facing' => 'N-Rd', 'land_katha' => 5.0, 'total_floors' => 9, 'status' => 'Ongoing', 'handover' => 'Oct-29', 'launch_date' => 'Jun-25']);
        $palolika = Project::create(['zone_id' => $bashundhara->id, 'type' => 'rr', 'name' => 'PALOLIKA', 'code' => 'A-5', 'address' => 'Re-Sale Dept.', 'road_facing' => '—', 'land_katha' => 2.0, 'total_floors' => 5, 'status' => 'Completed', 'handover' => '—', 'launch_date' => '—']);
        $skyline = Project::create(['zone_id' => $uttara->id, 'type' => 'regular', 'name' => 'SKYLINE UTTARA', 'code' => 'B-11', 'address' => 'House 11, Road 6, Sector 4', 'road_facing' => 'Main Rd', 'land_katha' => 8.0, 'total_floors' => 8, 'status' => 'Ongoing', 'handover' => 'Mar-27', 'launch_date' => 'Sep-24']);

        $mkFlat = fn (Project $p, int $floor, string $no, float $size, float $pricePerSft, string $status) => Flat::create([
            'project_id' => $p->id, 'floor' => $floor, 'flat_no' => $no, 'size_sft' => $size,
            'price_per_sft' => $pricePerSft, 'parking_charge' => 500000, 'parking_count' => 1,
            'parking_number' => strtoupper(substr($p->code ?: $p->name, 0, 1)) . $floor,
            'utility_charge' => 600000, 'reserve_fund' => 25000, 'facing' => 'N-Rd', 'bedroom' => 3, 'bathroom' => 3, 'balcony' => 2,
            'status_code' => $status,
        ]);

        $mkFlat($blueHaven, 9, 'A-2241 (9th)', 1650, 13200, 'AVAILABLE');
        $f102 = $mkFlat($blueHaven, 8, 'A-2241 (8th)', 1650, 13200, 'SOLD_CR');
        $mkFlat($blueHaven, 7, 'A-2241 (7th)', 1650, 12000, 'LAND_OWNER');
        $mkFlat($blueHaven, 6, 'A-2241 (6th)', 1650, 13000, 'SOLD_CR');
        $f105 = $mkFlat($blueHaven, 5, 'A-2241 (5th)', 1650, 12800, 'SOLD_OS_SS');
        $mkFlat($blueHaven, 4, 'A-2241 (4th)', 1650, 12000, 'LAND_OWNER');
        $f107 = $mkFlat($blueHaven, 3, 'A-2241 (3rd)', 1650, 12400, 'ASSET_BOOKED');
        $mkFlat($blueHaven, 2, 'A-2241 (2nd)', 1650, 12000, 'AVAILABLE');

        $mkFlat($springAura, 9, 'A (9th)', 1770, 13200, 'AVAILABLE');
        $mkFlat($springAura, 8, 'A (8th)', 1770, 13000, 'READY');
        $f203 = $mkFlat($springAura, 7, 'A (7th)', 1770, 12600, 'ASSET_BOOKED');
        $f204 = $mkFlat($springAura, 6, 'A (6th)', 1770, 13400, 'SOLD_OS_SS');
        $mkFlat($springAura, 5, 'A (5th)', 1770, 12000, 'LAND_OWNER');
        $mkFlat($springAura, 4, 'A (4th)', 1770, 12200, 'RESALE_RR');
        $mkFlat($springAura, 3, 'A (3rd)', 1770, 11800, 'AVAILABLE');
        $mkFlat($springAura, 2, 'A (2nd)', 1770, 11800, 'AVAILABLE');

        $mkFlat($nordica, 9, 'A-1808 (9th)', 1600, 15200, 'AVAILABLE');
        $mkFlat($nordica, 8, 'A-1808 (8th)', 1600, 15000, 'SOLD_CR');
        $mkFlat($nordica, 6, 'A-1808 (6th)', 1600, 14400, 'AVAILABLE');
        $mkFlat($nordica, 5, 'A-1808 (5th)', 1600, 14400, 'LAND_OWNER');
        $mkFlat($nordica, 4, 'A-1808 (4th)', 1600, 14200, 'AVAILABLE');

        $mkFlat($palolika, 5, 'A-5', 1200, 9500, 'RESALE_RR');

        $mkFlat($skyline, 8, 'B-11 (8th)', 1500, 10500, 'AVAILABLE');
        $mkFlat($skyline, 6, 'B-11 (6th)', 1500, 10200, 'SOLD_CR');
        $mkFlat($skyline, 5, 'B-11 (5th)', 1500, 10000, 'READY');
        $mkFlat($skyline, 4, 'B-11 (4th)', 1500, 9800, 'AVAILABLE');
        $mkFlat($skyline, 3, 'B-11 (3rd)', 1500, 9800, 'ASSET_BOOKED');

        // ---- 4. Customers ----
        $imran = Customer::create(['name' => 'Imran Kabir', 'phone' => '01711-000111', 'email' => 'imran@mail.com', 'reference_source' => 'Facebook', 'interested_project_id' => $blueHaven->id, 'interested_flat_id' => $f102->id, 'assigned_employee_id' => $rahim->id, 'status' => 'Sold']);
        $farzana = Customer::create(['name' => 'Farzana Rahman', 'phone' => '01711-000222', 'email' => 'farzana@mail.com', 'reference_source' => 'Friend', 'interested_project_id' => $blueHaven->id, 'interested_flat_id' => $f105->id, 'assigned_employee_id' => $karim->id, 'status' => 'Sold']);
        $tanvir = Customer::create(['name' => 'Tanvir Ahmed', 'phone' => '01711-000333', 'email' => 'tanvir@mail.com', 'reference_source' => 'Old Data', 'interested_project_id' => $blueHaven->id, 'interested_flat_id' => $f107->id, 'assigned_employee_id' => $rahim->id, 'status' => 'Booked']);
        $nusrat = Customer::create(['name' => 'Nusrat Jahan', 'phone' => '01711-000444', 'email' => 'nusrat@mail.com', 'reference_source' => 'Facebook', 'interested_project_id' => $springAura->id, 'interested_flat_id' => $f203->id, 'assigned_employee_id' => $karim->id, 'status' => 'Negotiation', 'notes' => 'Awaiting sale approval']);
        $sabbir = Customer::create(['name' => 'Sabbir Islam', 'phone' => '01711-000555', 'email' => 'sabbir@mail.com', 'reference_source' => 'Friend', 'interested_project_id' => $springAura->id, 'interested_flat_id' => $f204->id, 'assigned_employee_id' => $rahim->id, 'status' => 'Sold']);

        // ---- 5. Bookings ----
        Booking::create(['flat_id' => $f107->id, 'customer_id' => $tanvir->id, 'employee_id' => $rahim->id, 'amount' => 500000, 'date' => '2026-08-10', 'status' => 'active']);
        Booking::create(['flat_id' => $f203->id, 'customer_id' => $nusrat->id, 'employee_id' => $karim->id, 'amount' => 400000, 'date' => '2026-08-15', 'status' => 'active']);

        // ---- 6. Sales ----
        $s1 = Sale::create(['flat_id' => $f102->id, 'customer_id' => $imran->id, 'employee_id' => $rahim->id, 'sale_price' => $f102->calcSubTotal(), 'sold_price_per_sft' => $f102->price_per_sft - 400, 'sale_type' => 'SOLD_CR', 'date' => '2026-07-20', 'status' => 'confirmed', 'approved_by' => $admin->id]);
        $s2 = Sale::create(['flat_id' => $f105->id, 'customer_id' => $farzana->id, 'employee_id' => $karim->id, 'sale_price' => $f105->calcSubTotal(), 'sold_price_per_sft' => $f105->price_per_sft - 300, 'sale_type' => 'SOLD_OS_SS', 'date' => '2026-07-25', 'status' => 'confirmed', 'approved_by' => $admin->id]);
        $s3 = Sale::create(['flat_id' => $f204->id, 'customer_id' => $sabbir->id, 'employee_id' => $rahim->id, 'sale_price' => $f204->calcSubTotal(), 'sold_price_per_sft' => $f204->price_per_sft - 400, 'sale_type' => 'SOLD_OS_SS', 'date' => '2026-08-05', 'status' => 'confirmed', 'approved_by' => $owner->id]);
        Sale::create(['flat_id' => $f203->id, 'customer_id' => $nusrat->id, 'employee_id' => $karim->id, 'sale_price' => $f203->calcSubTotal(), 'sale_type' => 'SOLD_CR', 'date' => '2026-08-22', 'status' => 'pending']);

        // ---- 7. Payments ----
        Payment::create(['sale_id' => $s1->id, 'amount' => round($s1->sale_price * 0.6), 'date' => '2026-07-21', 'method' => 'Bank Transfer', 'recorded_by' => $admin->id]);
        Payment::create(['sale_id' => $s2->id, 'amount' => $s2->sale_price, 'date' => '2026-07-26', 'method' => 'Cheque', 'recorded_by' => $admin->id]);
        Payment::create(['sale_id' => $s3->id, 'amount' => round($s3->sale_price * 0.35), 'date' => '2026-08-06', 'method' => 'Bank Transfer', 'recorded_by' => $admin->id]);

        // ---- 8. Activity log ----
        ActivityLog::record($karim, 'Sale Created', 'Flat A (7th) — pending approval');
        ActivityLog::record($karim, 'Booking Created', 'Flat A (7th) booked for Nusrat Jahan');
        ActivityLog::record($rahim, 'Booking Created', 'Flat A-2241 (3rd) booked for Tanvir Ahmed');
        ActivityLog::record($admin, 'Payment Recorded', 'Payment against Sale #' . $s3->id);
        ActivityLog::record($owner, 'Sale Approved', 'Flat A-2241 (5th) → Sold (OS/SS)');

        $this->command?->info('Demo data seeded. All users password: password');
    }
}
