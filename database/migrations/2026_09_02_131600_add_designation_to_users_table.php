<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Job title (e.g. "Senior Manager") — distinct from `department`
            // (org unit, e.g. "Sales") and `employee_code` (ID code). Set
            // primarily from the Add/Edit Team modal for the Team Leader,
            // but usable for any user.
            $table->string('designation')->nullable()->after('department');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('designation');
        });
    }
};
