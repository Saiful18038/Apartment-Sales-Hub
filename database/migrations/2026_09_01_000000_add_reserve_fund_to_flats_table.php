<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flats', function (Blueprint $table) {
            $table->decimal('reserve_fund', 12, 2)->default(0)->after('utility_charge');
        });
    }

    public function down(): void
    {
        Schema::table('flats', function (Blueprint $table) {
            $table->dropColumn('reserve_fund');
        });
    }
};
