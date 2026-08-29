<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Roadmap Phase 14 — Document Management. Attaches to Project, Customer,
 * Booking, Sale, or Payment via a polymorphic relation.
 */
class Document extends Model
{
    public const CATEGORIES = ['Agreement', 'NID', 'Photo', 'Receipt', 'Other'];

    /** Only these models may have documents attached — validated in the controller. */
    public const DOCUMENTABLE_TYPES = [
        'project' => Project::class,
        'customer' => Customer::class,
        'booking' => Booking::class,
        'sale' => Sale::class,
        'payment' => Payment::class,
    ];

    protected $fillable = ['documentable_type', 'documentable_id', 'category', 'original_filename', 'stored_path', 'mime_type', 'size_bytes', 'uploaded_by'];

    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
