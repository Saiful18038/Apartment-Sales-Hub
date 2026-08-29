<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flat_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('amount', 12, 2)->default(0);
            $table->date('date');
            $table->enum('status', ['active', 'converted', 'cancelled'])->default('active');
            $table->timestamps();

            $table->index('employee_id'); // Phase 11 — row-level privacy lookups
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
