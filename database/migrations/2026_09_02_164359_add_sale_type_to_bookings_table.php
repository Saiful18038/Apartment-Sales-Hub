<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // Owner's request: a booked flat shows the specific Sold (CR)/
            // Sold (OS/SS) status immediately, not a generic "Sold Out" —
            // so the intended sale type is chosen at booking time, same
            // enum as sales.sale_type.
            $table->enum('sale_type', ['SOLD_CR', 'SOLD_OS_SS'])->default('SOLD_CR')->after('amount');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('sale_type');
        });
    }
};
