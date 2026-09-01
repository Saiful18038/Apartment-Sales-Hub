<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\FlatController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ZoneController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Authenticated + license-gated (mirrors <LicenseGate> in the React prototype —
// see App\Http\Middleware\CheckLicense).
Route::middleware(['auth:sanctum', 'license'])->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // ---- read access: any authenticated role ----
    Route::get('/zones', [ZoneController::class, 'index']);
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/flats', [FlatController::class, 'index']);
    Route::get('/flats/{flat}', [FlatController::class, 'show']);
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::put('/customers/{customer}', [CustomerController::class, 'update']);
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::post('/bookings/{booking}/convert-to-sale', [BookingController::class, 'convertToSale']);
    Route::get('/sales', [SaleController::class, 'index']);
    Route::post('/sales', [SaleController::class, 'store']);
    Route::get('/payments', [PaymentController::class, 'index']);
    Route::post('/payments', [PaymentController::class, 'store']);
    Route::get('/reports/floor-stock-summary', [ReportController::class, 'floorAndStockSummary']);
    Route::get('/activity-logs', [ActivityLogController::class, 'index']);

    // ---- Roadmap Phase 14 — Document Management ----
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::get('/documents/{document}/download', [DocumentController::class, 'download']);
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);

    // ---- Roadmap Phase 19 — Notification System ----
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    // ---- Admin / Owner only (Roadmap Phase 1 RBAC) ----
    Route::middleware('role:owner,admin')->group(function () {
        Route::post('/zones', [ZoneController::class, 'store']);
        Route::put('/zones/{zone}', [ZoneController::class, 'update']);
        Route::delete('/zones/{zone}', [ZoneController::class, 'destroy']);

        Route::post('/projects', [ProjectController::class, 'store']);
        Route::put('/projects/{project}', [ProjectController::class, 'update']);
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

        Route::post('/flats', [FlatController::class, 'store']);
        Route::put('/flats/{flat}', [FlatController::class, 'update']);
        Route::delete('/flats/{flat}', [FlatController::class, 'destroy']);
        Route::patch('/flats/{flat}/status', [FlatController::class, 'changeStatus']);
        Route::post('/flats/{flat}/exchange-parking', [FlatController::class, 'exchangeParking']);

        Route::post('/sales/{sale}/approve', [SaleController::class, 'approve']);
        Route::post('/sales/{sale}/reject', [SaleController::class, 'reject']);

        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
    });

    // ---- Owner only — narrower than the group above. Cancelling booking
    // money is a financial reversal the owner alone should be able to make,
    // not admin and not the employee who took the booking. ----
    Route::middleware('role:owner')->group(function () {
        Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel']);
    });
});
