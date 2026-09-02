<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            // Owner's request: "টাকা এড করার সাথে সাথে বর্তমান Date & Time
            // অটো-জেনারেট হবে" — auto-set server-side (now()), never a
            // client-supplied value — every installment toward the fixed
            // bookings.amount target gets its own real timestamp.
            $table->timestamp('paid_at');
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index('booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_payments');
    }
};
