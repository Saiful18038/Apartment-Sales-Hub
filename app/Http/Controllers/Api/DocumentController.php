<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Roadmap Phase 14 — Document Management. Files are stored on the private
 * "local" disk (storage/app/private — not web-accessible) and only ever
 * served through download(), which re-checks the same employee-privacy
 * rules as Phase 11 before streaming a single byte.
 */
class DocumentController extends Controller
{
    public function index(Request $request)
    {
        [$type, $model] = $this->resolveType($request->query('documentable_type'));
        $documentable = $model::findOrFail($request->query('documentable_id'));
        $this->authorizeAccess($request->user(), $documentable);

        return $documentable->documents()->with('uploader:id,name')->latest()->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'documentable_type' => 'required|string',
            'documentable_id' => 'required|integer',
            'category' => 'nullable|in:' . implode(',', Document::CATEGORIES),
            'file' => 'required|file|max:10240|mimes:pdf,jpg,jpeg,png,doc,docx,xls,xlsx',
        ]);

        [$type, $model] = $this->resolveType($data['documentable_type']);
        $documentable = $model::findOrFail($data['documentable_id']);
        $this->authorizeAccess($request->user(), $documentable);

        $file = $request->file('file');
        $storedPath = $file->store("documents/{$type}/{$documentable->id}", 'local');

        $document = Document::create([
            'documentable_type' => $model,
            'documentable_id' => $documentable->id,
            'category' => $data['category'] ?? 'Other',
            'original_filename' => $file->getClientOriginalName(),
            'stored_path' => $storedPath,
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
            'uploaded_by' => $request->user()->id,
        ]);

        ActivityLog::record($request->user(), 'Document Uploaded', "{$document->original_filename} → {$type} #{$documentable->id}");

        return response()->json($document->load('uploader:id,name'), 201);
    }

    public function download(Request $request, Document $document)
    {
        $this->authorizeAccess($request->user(), $document->documentable);

        if (!Storage::disk('local')->exists($document->stored_path)) {
            abort(404, 'File missing from storage.');
        }

        return Storage::disk('local')->download($document->stored_path, $document->original_filename);
    }

    public function destroy(Request $request, Document $document)
    {
        $user = $request->user();
        if (!$user->canManage() && $document->uploaded_by !== $user->id) {
            return response()->json(['message' => 'Forbidden — only the uploader or an Admin/Owner can delete this document.'], 403);
        }

        Storage::disk('local')->delete($document->stored_path);
        $name = $document->original_filename;
        $document->delete();

        ActivityLog::record($user, 'Document Deleted', $name);
        return response()->json(['message' => 'Deleted']);
    }

    /** @return array{0: string, 1: class-string} */
    private function resolveType(?string $type): array
    {
        $type = strtolower((string) $type);
        if (!isset(Document::DOCUMENTABLE_TYPES[$type])) {
            abort(422, 'Invalid documentable_type. Allowed: ' . implode(', ', array_keys(Document::DOCUMENTABLE_TYPES)));
        }
        return [$type, Document::DOCUMENTABLE_TYPES[$type]];
    }

    /**
     * Roadmap Phase 14 note: "Access role অনুযায়ী restricted হবে" — reuses
     * the exact same employee-privacy boundary as Phase 11 (Sale/Booking/
     * Customer scopeVisibleTo) instead of inventing a separate rule set.
     */
    private function authorizeAccess($user, $documentable): void
    {
        if (!$user->isEmployee()) {
            return; // owner/admin see everything
        }

        $employeeId = match (true) {
            $documentable instanceof \App\Models\Customer => $documentable->assigned_employee_id,
            $documentable instanceof \App\Models\Booking, $documentable instanceof \App\Models\Sale => $documentable->employee_id,
            $documentable instanceof Payment => $documentable->sale->employee_id,
            default => null, // Project documents are visible to every authenticated role
        };

        if ($employeeId !== null && $employeeId !== $user->id) {
            abort(403, 'Forbidden — this document belongs to a record assigned to another employee.');
        }
    }
}
