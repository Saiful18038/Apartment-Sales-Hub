<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Flat;
use App\Models\Project;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Owner's request: an in-app AI assistant staff can ask about apartment
 * sales — "অ্যাপার্টমেন্ট বিক্রয়ের তথ্য জানতে চাইলে ... সঠিক তথ্য দেবে" (when
 * someone wants to know apartment sales info, give the correct info).
 * Answers are grounded ONLY in a fresh data snapshot built for every
 * request (never the model's own training knowledge, and never stale),
 * and that snapshot is scoped to exactly what the asking user is already
 * allowed to see — the same Sale::visibleTo()/Customer::visibleTo()/
 * Booking::visibleTo() rules enforced everywhere else in the app, so the
 * assistant can't leak another employee's or team's data any more than
 * the rest of the UI can.
 *
 * SMS Q&A was explicitly deferred (needs a paid SMS gateway — Twilio or a
 * local BD provider — not set up yet); this wires up the in-app chat only.
 */
class AiAssistantService
{
    public function isConfigured(): bool
    {
        return filled(config('services.anthropic.api_key'));
    }

    public function ask(User $user, string $message): string
    {
        if (!$this->isConfigured()) {
            return "AI Assistant isn't configured yet — an owner/admin needs to add an ANTHROPIC_API_KEY "
                . "(from console.anthropic.com) to the server's .env file. Once that's set, I'll be able to "
                . "answer real questions about flats, sales, and bookings.";
        }

        $context = $this->buildContext($user);

        try {
            $response = Http::withHeaders([
                'x-api-key' => config('services.anthropic.api_key'),
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])->timeout(30)->post('https://api.anthropic.com/v1/messages', [
                'model' => config('services.anthropic.model'),
                'max_tokens' => 1024,
                'system' => $this->systemPrompt($user, $context),
                'messages' => [
                    ['role' => 'user', 'content' => $message],
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('AI Assistant request failed', ['error' => $e->getMessage()]);
            return "Sorry, I couldn't reach the AI service just now. Please try again in a moment.";
        }

        if ($response->failed()) {
            Log::warning('AI Assistant API error', ['status' => $response->status(), 'body' => $response->body()]);
            return "Sorry, the AI service returned an error (HTTP {$response->status()}). Please try again shortly.";
        }

        $block = collect($response->json('content'))->firstWhere('type', 'text');
        return $block['text'] ?? "Sorry, I couldn't come up with an answer to that.";
    }

    private function systemPrompt(User $user, array $context): string
    {
        return "You are the AI Assistant built into Apartment Sales Hub, a real-estate sales tracking app. "
            . "Answer the staff member's question about zones, projects, flats, sales, bookings, or customers "
            . "using ONLY the JSON data below — it is a live snapshot scoped to exactly what this user "
            . "(role: {$user->role}) is allowed to see in the app. Never invent flats, prices, or people not "
            . "present in this data, and never fill in a number you're not sure of. If the answer isn't in the "
            . "data, say so plainly rather than guessing. Keep answers short and direct — a sentence or a short "
            . "list, not a report. Reply in the same language the question was asked in (Bengali or English). "
            . "All currency is BDT, shown with the ৳ symbol.\n\n"
            . "DATA:\n" . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /** A live, role-scoped snapshot of the data this assistant is allowed to answer from. */
    private function buildContext(User $user): array
    {
        $flats = Flat::with('project')->get()->map(fn (Flat $f) => [
            'flat_no' => $f->flat_no,
            'project' => $f->project->name ?? null,
            'floor' => $f->floor,
            'size_sft' => (float) $f->size_sft,
            'price_per_sft' => (float) $f->price_per_sft,
            'facing' => $f->facing,
            'bedroom' => $f->bedroom,
            'bathroom' => $f->bathroom,
            'status' => $f->status_code,
        ]);

        $projects = Project::with('zone')->get()->map(fn (Project $p) => [
            'name' => $p->name,
            'zone' => $p->zone->name ?? null,
            'type' => $p->type,
            'status' => $p->status,
            'total_floors' => $p->total_floors,
            'handover' => $p->handover,
            'launch_date' => $p->launch_date,
        ]);

        // sale_price is already the fully-negotiated total (see
        // SaleController::store/update and BookingController::convertToSale
        // — both apply sold_price_per_sft when one was given), so this is
        // the real "what did it actually sell for", not the listing price.
        $sales = Sale::visibleTo($user)->where('status', 'confirmed')
            ->with(['flat', 'customer', 'employee'])->get()
            ->map(fn (Sale $s) => [
                'flat' => $s->flat->flat_no ?? null,
                'customer' => $s->customer->name ?? null,
                'sold_by' => $s->employee->name ?? null,
                'sale_type' => $s->sale_type,
                'sale_price' => (float) $s->sale_price,
                'date' => $s->date,
            ]);

        $bookings = Booking::visibleTo($user)->where('status', 'active')
            ->with(['flat', 'customer', 'employee'])->get()
            ->map(fn (Booking $b) => [
                'flat' => $b->flat->flat_no ?? null,
                'customer' => $b->customer->name ?? null,
                'booked_by' => $b->employee->name ?? null,
                'sale_type' => $b->sale_type,
                'booking_target_amount' => (float) $b->amount,
                'paid_so_far' => $b->paid_amount,
            ]);

        $customers = Customer::visibleTo($user)->with(['interestedProject', 'interestedFlat', 'assignedEmployee'])->get()
            ->map(fn (Customer $c) => [
                'name' => $c->name,
                'status' => $c->status,
                'reference_source' => $c->reference_source,
                'interested_project' => $c->interestedProject->name ?? null,
                'interested_flat' => $c->interestedFlat->flat_no ?? null,
                'assigned_to' => $c->assignedEmployee->name ?? null,
            ]);

        return [
            'summary' => [
                'total_flats' => $flats->count(),
                'available_flats' => $flats->where('status', 'AVAILABLE')->count(),
                'sold_flats' => $flats->whereIn('status', ['SOLD_CR', 'SOLD_OS_SS'])->count(),
                'confirmed_sales_visible_to_you' => $sales->count(),
                'total_revenue_visible_to_you' => $sales->sum('sale_price'),
                'active_bookings_visible_to_you' => $bookings->count(),
            ],
            'flats' => $flats->values(),
            'projects' => $projects->values(),
            'confirmed_sales' => $sales->values(),
            'active_bookings' => $bookings->values(),
            'customers' => $customers->values(),
        ];
    }
}
