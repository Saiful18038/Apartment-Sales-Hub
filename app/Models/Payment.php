<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = ['sale_id', 'amount', 'date', 'method', 'recorded_by', 'custom'];

    protected $casts = ['custom' => 'array'];

    public function sale()       { return $this->belongsTo(Sale::class); }
    public function recordedBy() { return $this->belongsTo(User::class, 'recorded_by'); }
    public function documents()  { return $this->morphMany(Document::class, 'documentable'); }
}
