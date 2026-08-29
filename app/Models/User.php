<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'password', 'role', 'employee_code', 'department', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_active' => 'boolean',
    ];

    // ---- role helpers (Roadmap Phase 1 — RBAC) ----
    public function isOwner(): bool   { return $this->role === 'owner'; }
    public function isAdmin(): bool   { return $this->role === 'admin'; }
    public function isEmployee(): bool { return $this->role === 'employee'; }
    public function canManage(): bool { return $this->isOwner() || $this->isAdmin(); }

    public function sales()    { return $this->hasMany(Sale::class, 'employee_id'); }
    public function bookings() { return $this->hasMany(Booking::class, 'employee_id'); }
    public function customers(){ return $this->hasMany(Customer::class, 'assigned_employee_id'); }
}
