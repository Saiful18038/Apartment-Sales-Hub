<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            // "Client Reference" — how this lead reached us (Facebook,
            // Friend, Old Data, ...). Free string rather than a DB enum so
            // the frontend's option list can grow without a migration.
            $table->string('reference_source')->nullable()->after('nid');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('reference_source');
        });
    }
};
