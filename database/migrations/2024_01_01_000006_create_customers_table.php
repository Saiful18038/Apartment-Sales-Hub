<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('nid')->nullable();
            $table->foreignId('interested_project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('interested_flat_id')->nullable()->constrained('flats')->nullOnDelete();
            $table->foreignId('assigned_employee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['New', 'Interested', 'Follow-up', 'Negotiation', 'Booked', 'Sold', 'Lost'])->default('New');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('assigned_employee_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
