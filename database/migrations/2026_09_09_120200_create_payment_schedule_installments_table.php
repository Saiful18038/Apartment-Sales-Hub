<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rows of the "Payment Schedule" table on a price_schedule — one planned
 * instalment each (Booking Money, the provisional payments, Last Payment).
 *
 * "Money actually received" still lives in the `payments` table: flipping an
 * instalment to `paid` creates a linked Payment (payment_id) so the
 * Dashboard's paid/due figures stay correct, and flipping it back deletes
 * that Payment. `overdue` is derived at read time from the due date, never
 * stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_schedule_installments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('price_schedule_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort')->default(0);
            $table->string('milestone');
            $table->string('term')->default('On / Before');
            $table->date('due_date')->nullable();
            $table->decimal('amount', 14, 2)->default(0);
            $table->enum('status', ['pending', 'paid'])->default('pending');
            $table->date('paid_on')->nullable();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['price_schedule_id', 'sort']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_schedule_installments');
    }
};
