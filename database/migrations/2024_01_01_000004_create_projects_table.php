<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['regular', 'rr'])->default('regular'); // regular vs Re-Sale (RR)
            $table->string('name');
            $table->string('code')->nullable();
            $table->string('address')->nullable();
            $table->string('road_facing')->nullable();
            $table->decimal('land_katha', 6, 2)->nullable();
            $table->unsignedSmallInteger('total_floors')->default(0);
            $table->enum('status', ['Planning', 'Ongoing', 'Completed', 'Suspended', 'Archived'])->default('Planning');
            $table->string('handover')->nullable(); // e.g. "Nov-28"
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
