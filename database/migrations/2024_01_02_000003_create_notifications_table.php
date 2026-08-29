<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Roadmap Phase 19 — Notification System. Standard Laravel "database"
 * notification channel table — every notification (Booking Confirmation,
 * Payment Due Reminder, Follow-up Reminder, License Expiry Reminder) is
 * stored here so the frontend has something to list/mark-read, regardless
 * of whether real email/SMS delivery is configured yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
