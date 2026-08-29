<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Roadmap Phase 19 — Notification System. Requires the scheduler to
// actually be running (`php artisan schedule:work` in dev, or a single
// cron entry calling `schedule:run` every minute in production).
Schedule::command('app:send-payment-due-reminders')->daily();
Schedule::command('app:send-follow-up-reminders')->daily();
Schedule::command('app:send-license-expiry-reminders')->daily();
