<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Holds the free-text values for a sale's user-defined Excel Sheet columns
 * (see payment_sheet_columns), as a JSON object keyed by column id:
 * {"3": "DBBL 12345", "4": "paid at branch"}. Keys with no matching
 * payment_sheet_columns row are simply not rendered, so a deleted column
 * leaves no visible trace even before its orphan values are pruned.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->json('custom')->nullable()->after('method');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('custom');
        });
    }
};
