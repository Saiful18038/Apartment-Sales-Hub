<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Owner's request: each sale's "Excel Sheet" in Payments should let the
 * owner add their own extra columns (e.g. "Cheque No", "Bank Name",
 * "Remark") on top of the fixed Date/Method/Amount ledger. Columns are
 * scoped per-sale — one sheet's columns don't appear on another's — so
 * they live in their own table keyed by sale_id. The free-text value a
 * column holds for a given installment is stored as a JSON map on the
 * payment row itself (see the add_custom_to_payments migration).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_sheet_columns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_sheet_columns');
    }
};
