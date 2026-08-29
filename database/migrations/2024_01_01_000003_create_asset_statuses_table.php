<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Database-driven colour status system (Roadmap Phase 6).
 * Seeded once in DemoDataSeeder — single source of truth that both the
 * API and the frontend colour map read from.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_statuses', function (Blueprint $table) {
            $table->string('code')->primary(); // AVAILABLE, LAND_OWNER, SOLD_CR, SOLD_OS_SS, RESALE_RR, ASSET_BOOKED, READY
            $table->string('label');
            $table->string('fill_color', 7);
            $table->string('border_color', 7);
            $table->string('text_color', 7);
            $table->boolean('is_sellable')->default(true);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_statuses');
    }
};
