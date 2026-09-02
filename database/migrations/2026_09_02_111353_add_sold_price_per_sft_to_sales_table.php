<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            // The actual negotiated per-sft price, distinct from the flat's
            // listing price_per_sft — shown side by side on the Sold Out
            // flat detail so the discount/negotiation is visible at a glance.
            $table->decimal('sold_price_per_sft', 10, 2)->nullable()->after('sale_price');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('sold_price_per_sft');
        });
    }
};
