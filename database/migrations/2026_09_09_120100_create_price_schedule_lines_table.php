<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rows of the "Price" calculation table on a price_schedule — Apartment
 * Value, Car Parking, Sub Total, Less: Special Rebate, Revised Sub Total,
 * Utilities, Reserve Fund, Total. The three running-total kinds
 * (subtotal / revised_subtotal / total) are recomputed server-side from the
 * item/rebate rows around them, so is_computed rows are never hand-edited.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_schedule_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('price_schedule_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->string('description');
            $table->enum('line_type', ['item', 'rebate', 'subtotal', 'revised_subtotal', 'total'])->default('item');
            // Only the Apartment Value row uses this: amount = size_sft * rate_per_sft.
            $table->decimal('rate_per_sft', 12, 2)->nullable();
            $table->decimal('amount', 14, 2)->default(0);
            $table->boolean('is_computed')->default(false);
            $table->timestamps();

            $table->index(['price_schedule_id', 'sort']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_schedule_lines');
    }
};
