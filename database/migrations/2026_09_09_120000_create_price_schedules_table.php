<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Owner's request: replace the per-sale "Excel Sheet" ledger with a
 * structured "Final Price & Payment Schedule" document that mirrors the
 * company's real hand-out (Asset Developments' PDF) — a price-calculation
 * table + an instalment schedule + printable PDF/Excel.
 *
 * One schedule per sale. The header fields are SNAPSHOTTED from the
 * flat/project/sale the first time the schedule is opened, then edited on
 * the schedule itself, so a later change to the flat never rewrites a
 * document that was already handed to a customer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->unique()->constrained()->cascadeOnDelete();

            $table->date('agreement_date')->nullable();

            // Snapshot of the apartment/project identity at issue time.
            $table->string('project_name')->nullable();
            $table->string('project_address')->nullable();
            $table->string('apartment_type')->nullable();
            $table->string('apartment_facing')->nullable();
            $table->string('floor')->nullable();
            $table->decimal('size_sft', 10, 2)->nullable();
            $table->decimal('rate_per_sft', 12, 2)->nullable();

            // Footer notes printed under the schedule.
            $table->text('terms')->nullable();

            // true once the owner has deliberately saved with the
            // instalment total not matching the price total.
            $table->boolean('totals_overridden')->default(false);

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_schedules');
    }
};
