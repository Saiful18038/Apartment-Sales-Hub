<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flat_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('sale_price', 14, 2)->default(0);
            $table->enum('sale_type', ['SOLD_CR', 'SOLD_OS_SS'])->default('SOLD_CR');
            $table->date('date');
            // Phase 10 — Approval workflow: employee-created sales start pending.
            $table->enum('status', ['pending', 'confirmed', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('employee_id'); // Phase 11 — row-level privacy lookups
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
