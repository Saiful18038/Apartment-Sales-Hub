<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds RBAC fields on top of Laravel's default users table.
 * Roles: owner | admin | employee  (Roadmap Part A / Phase 1)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('employee')->after('email'); // owner | admin | employee
            $table->string('employee_code')->nullable()->unique()->after('role');
            $table->string('department')->nullable()->after('employee_code');
            $table->boolean('is_active')->default(true)->after('department');
            $table->unsignedInteger('failed_login_attempts')->default(0)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'employee_code', 'department', 'is_active', 'failed_login_attempts']);
        });
    }
};
