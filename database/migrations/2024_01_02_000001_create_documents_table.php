<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Roadmap Phase 14 — Document Management. A document can attach to a
 * Project, Customer, Booking, Sale, or Payment (polymorphic — one table
 * instead of five near-identical ones). "Agreement" from the roadmap's
 * list is handled as a `category` value on the document, not a separate
 * documentable type — there is no standalone Agreement entity in the MVP.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->morphs('documentable'); // documentable_type, documentable_id
            $table->string('category')->default('Other'); // Agreement, NID, Photo, Receipt, Other
            $table->string('original_filename');
            $table->string('stored_path'); // private disk path — never served directly
            $table->string('mime_type');
            $table->unsignedBigInteger('size_bytes');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
