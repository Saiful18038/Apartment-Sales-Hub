<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('floor');
            $table->string('flat_no');
            $table->decimal('size_sft', 8, 2)->default(0);
            $table->decimal('price_per_sft', 10, 2)->default(0);
            $table->decimal('parking_charge', 12, 2)->default(0);
            $table->unsignedTinyInteger('parking_count')->default(0);
            $table->decimal('utility_charge', 12, 2)->default(0);
            $table->string('facing')->nullable();
            $table->unsignedTinyInteger('bedroom')->nullable();
            $table->unsignedTinyInteger('bathroom')->nullable();
            $table->unsignedTinyInteger('balcony')->nullable();
            $table->string('status_code')->default('AVAILABLE');
            $table->foreign('status_code')->references('code')->on('asset_statuses');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'floor']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flats');
    }
};
