<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Payment;
use App\Models\PriceSchedule;
use App\Models\Sale;
use App\Services\LicenseService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\PriceScheduleExport;

/**
 * The per-sale "Final Price & Payment Schedule" document (replaces the old
 * per-sale "Excel Sheet" ledger). One schedule per sale; the header is
 * snapshotted from the flat/project/sale the first time it is opened, then
 * edited here. Marking an instalment paid creates a linked Payment so the
 * Dashboard's paid/due totals stay correct.
 */
class PriceScheduleController extends Controller
{
    public function __construct(protected LicenseService $license) {}

    /** GET /sales/{sale}/price-schedule — auto-creates a prefilled draft. */
    public function show(Request $request, Sale $sale)
    {
        $this->authorizeSale($request, $sale);

        $schedule = $sale->priceSchedule;
        if (! $schedule) {
            $schedule = $this->buildDraft($request, $sale);
        }

        return response()->json($this->serialize($schedule->fresh(['lines', 'installments']), $sale));
    }

    /** PUT /sales/{sale}/price-schedule — owner/admin only (see routes). */
    public function update(Request $request, Sale $sale)
    {
        $this->license->guard();

        $data = $request->validate([
            'agreement_date' => 'nullable|date',
            'project_name' => 'nullable|string|max:255',
            'project_address' => 'nullable|string|max:255',
            'apartment_type' => 'nullable|string|max:255',
            'apartment_facing' => 'nullable|string|max:255',
            'floor' => 'nullable|string|max:255',
            'size_sft' => 'nullable|numeric|min:0',
            'rate_per_sft' => 'nullable|numeric|min:0',
            'terms' => 'nullable|string|max:5000',
            'allow_mismatch' => 'boolean',

            'lines' => 'present|array',
            'lines.*.id' => 'nullable|integer',
            'lines.*.sort' => 'required|integer|min:0',
            'lines.*.description' => 'required|string|max:255',
            'lines.*.line_type' => 'required|in:item,rebate,subtotal,revised_subtotal,total',
            'lines.*.rate_per_sft' => 'nullable|numeric|min:0',
            'lines.*.amount' => 'nullable|numeric',

            'installments' => 'present|array',
            'installments.*.id' => 'nullable|integer',
            'installments.*.sort' => 'required|integer|min:0',
            'installments.*.milestone' => 'required|string|max:255',
            'installments.*.term' => 'nullable|string|max:100',
            'installments.*.due_date' => 'nullable|date',
            'installments.*.amount' => 'required|numeric|min:0',
            'installments.*.status' => 'required|in:pending,paid',
            'installments.*.paid_on' => 'nullable|date',
            'installments.*.method' => 'nullable|string|max:100',
            'installments.*.note' => 'nullable|string|max:255',
        ]);

        $schedule = $sale->priceSchedule ?: $this->buildDraft($request, $sale);

        DB::transaction(function () use ($schedule, $sale, $data, $request) {
            $schedule->update([
                'agreement_date' => $data['agreement_date'] ?? null,
                'project_name' => $data['project_name'] ?? null,
                'project_address' => $data['project_address'] ?? null,
                'apartment_type' => $data['apartment_type'] ?? null,
                'apartment_facing' => $data['apartment_facing'] ?? null,
                'floor' => $data['floor'] ?? null,
                'size_sft' => $data['size_sft'] ?? null,
                'rate_per_sft' => $data['rate_per_sft'] ?? null,
                'terms' => $data['terms'] ?? null,
            ]);

            $this->syncLines($schedule, $data['lines']);
            $schedule->load('lines');
            $schedule->recalculate();

            $this->syncInstallments($request, $schedule, $sale, $data['installments']);
        });

        $schedule = $schedule->fresh(['lines', 'installments']);

        if (! $schedule->totalsMatch() && ! ($data['allow_mismatch'] ?? false)) {
            return response()->json([
                'message' => 'Instalment total does not match the price Total.',
                'delta' => round($schedule->installmentsTotal() - $schedule->grandTotal(), 2),
                'grand_total' => $schedule->grandTotal(),
                'installments_total' => $schedule->installmentsTotal(),
            ], 422);
        }

        $schedule->update(['totals_overridden' => ! $schedule->totalsMatch()]);

        ActivityLog::record($request->user(), 'Price Schedule Updated', $sale->flat->flat_no);

        return response()->json($this->serialize($schedule->fresh(['lines', 'installments']), $sale->fresh()));
    }

    /** GET /sales/{sale}/price-schedule/pdf[?inline=1] */
    public function pdf(Request $request, Sale $sale)
    {
        $this->authorizeSale($request, $sale);

        $schedule = $sale->priceSchedule ?: $this->buildDraft($request, $sale);
        $schedule->load(['lines', 'installments']);

        $pdf = Pdf::loadView('pdf.price-schedule', [
            'schedule' => $schedule,
            'sale' => $sale->load('flat.project', 'customer'),
        ])->setPaper('a4');

        $name = 'Price-Schedule-' . str_replace([' ', '/'], '-', $sale->flat->flat_no) . '.pdf';

        return $request->boolean('inline')
            ? $pdf->stream($name)
            : $pdf->download($name);
    }

    /** GET /sales/{sale}/price-schedule/excel */
    public function excel(Request $request, Sale $sale)
    {
        $this->authorizeSale($request, $sale);

        $schedule = $sale->priceSchedule ?: $this->buildDraft($request, $sale);
        $schedule->load(['lines', 'installments']);

        $name = 'Price-Schedule-' . str_replace([' ', '/'], '-', $sale->flat->flat_no) . '.xlsx';

        return Excel::download(new PriceScheduleExport($schedule, $sale->load('flat.project', 'customer')), $name);
    }

    // ---------------------------------------------------------------- //

    private function authorizeSale(Request $request, Sale $sale): void
    {
        $visible = Sale::query()->visibleTo($request->user())->whereKey($sale->getKey())->exists();
        abort_unless($visible, 403, 'Not allowed to view this sale.');
    }

    /**
     * Create the prefilled schedule for a sale that has none yet: header
     * snapshot from the flat/project/sale, the reference PDF's price rows,
     * and — for a sale that already has payments — one `paid` instalment per
     * payment so nothing recorded is lost in the switch-over.
     */
    private function buildDraft(Request $request, Sale $sale): PriceSchedule
    {
        $sale->loadMissing('flat.project', 'payments');
        $flat = $sale->flat;
        $project = $flat?->project;

        return DB::transaction(function () use ($request, $sale, $flat, $project) {
            $rate = (float) ($sale->sold_price_per_sft ?: ($flat->price_per_sft ?? 0));
            $size = (float) ($flat->size_sft ?? 0);
            $parking = (float) ($flat->parking_charge ?? 0) * (int) ($flat->parking_count ?? 0);
            $utility = (float) ($flat->utility_charge ?? 0);
            $reserve = (float) ($flat->reserve_fund ?? 0);

            $schedule = PriceSchedule::create([
                'sale_id' => $sale->id,
                'agreement_date' => $sale->date ?? now()->toDateString(),
                'project_name' => $project->name ?? null,
                'project_address' => $project->address ?? null,
                'apartment_type' => $flat->flat_no ?? null,
                'apartment_facing' => $flat->facing ?? ($project->road_facing ?? null),
                'floor' => $flat->floor !== null ? (string) $flat->floor : null,
                'size_sft' => $size ?: null,
                'rate_per_sft' => $rate ?: null,
                'terms' => PriceSchedule::DEFAULT_TERMS,
                'created_by' => $request->user()->id,
            ]);

            $lines = [
                ['description' => 'Apartment Value', 'line_type' => 'item', 'rate_per_sft' => $rate ?: null, 'amount' => round($rate * $size, 2)],
                ['description' => 'Cost Of Car Parking Space', 'line_type' => 'item', 'amount' => $parking],
                ['description' => 'Sub Total', 'line_type' => 'subtotal', 'is_computed' => true],
                ['description' => 'Less: Special Rebate', 'line_type' => 'rebate', 'amount' => 0],
                ['description' => 'Revised Sub Total', 'line_type' => 'revised_subtotal', 'is_computed' => true],
                ['description' => 'Utilities Connection Cost', 'line_type' => 'item', 'amount' => $utility],
                ['description' => 'Reserve Fund For Common Services (Refundable)', 'line_type' => 'item', 'amount' => $reserve],
                ['description' => 'Total', 'line_type' => 'total', 'is_computed' => true],
            ];
            foreach ($lines as $i => $row) {
                $schedule->lines()->create($row + ['sort' => $i]);
            }

            $schedule->load('lines');
            $schedule->recalculate();

            $payments = $sale->payments->sortBy('date')->values();
            if ($payments->isNotEmpty()) {
                foreach ($payments as $i => $p) {
                    $schedule->installments()->create([
                        'sort' => $i,
                        'milestone' => 'Payment ' . ($i + 1),
                        'term' => 'On / Before',
                        'due_date' => $p->date,
                        'amount' => $p->amount,
                        'status' => 'paid',
                        'paid_on' => $p->date,
                        'payment_id' => $p->id,
                    ]);
                }
            } else {
                $schedule->installments()->create([
                    'sort' => 0,
                    'milestone' => 'Provisional Booking Money',
                    'term' => 'On / Before',
                    'due_date' => now()->toDateString(),
                    'amount' => 0,
                    'status' => 'pending',
                ]);
            }

            return $schedule;
        });
    }

    /** Replace the price lines: update by id, insert new, delete missing. */
    private function syncLines(PriceSchedule $schedule, array $rows): void
    {
        $keepIds = [];
        foreach ($rows as $row) {
            $attrs = [
                'sort' => $row['sort'],
                'description' => $row['description'],
                'line_type' => $row['line_type'],
                'rate_per_sft' => $row['rate_per_sft'] ?? null,
                'amount' => $row['amount'] ?? 0,
                'is_computed' => in_array($row['line_type'], ['subtotal', 'revised_subtotal', 'total'], true),
            ];

            $existing = ! empty($row['id']) ? $schedule->lines()->whereKey($row['id'])->first() : null;
            if ($existing) {
                $existing->update($attrs);
                $keepIds[] = $existing->id;
            } else {
                $keepIds[] = $schedule->lines()->create($attrs)->id;
            }
        }
        $schedule->lines()->whereKeyNot($keepIds)->delete();
    }

    /**
     * Replace the instalments, and reconcile the linked cash: a
     * pending->paid flip creates a Payment, a paid->pending flip deletes it.
     */
    private function syncInstallments(Request $request, PriceSchedule $schedule, Sale $sale, array $rows): void
    {
        $current = $schedule->installments()->get()->keyBy('id');
        $keepIds = [];

        foreach ($rows as $row) {
            $existing = ! empty($row['id']) ? $current->get($row['id']) : null;
            $wasPaid = $existing && $existing->status === 'paid';
            $wantsPaid = $row['status'] === 'paid';

            $attrs = [
                'sort' => $row['sort'],
                'milestone' => $row['milestone'],
                'term' => $row['term'] ?? 'On / Before',
                'due_date' => $row['due_date'] ?? null,
                'amount' => $row['amount'],
                'status' => $row['status'],
                'paid_on' => $wantsPaid ? ($row['paid_on'] ?? now()->toDateString()) : null,
                'note' => $row['note'] ?? null,
            ];

            $inst = $existing ?: $schedule->installments()->make();
            $inst->fill($attrs);
            if (! $existing) {
                $inst->price_schedule_id = $schedule->id;
            }

            // pending -> paid : record the cash
            if ($wantsPaid && ! $wasPaid) {
                $inst->payment_id = $this->createLinkedPayment($request, $sale, (float) $row['amount'], $attrs['paid_on'], $row['method'] ?? null)?->id;
            }
            // paid -> pending : remove the cash
            if ($wasPaid && ! $wantsPaid && $existing->payment_id) {
                $this->releasePayment($existing->payment_id);
                $inst->payment_id = null;
            }

            $inst->save();
            $keepIds[] = $inst->id;
        }

        // Deleting a paid instalment also releases its linked payment.
        $schedule->installments()->whereKeyNot($keepIds)->get()->each(function ($inst) {
            if ($inst->payment_id) {
                $this->releasePayment($inst->payment_id);
            }
            $inst->delete();
        });
    }

    /**
     * Undo a schedule-recorded payment: delete it, unless it has documents
     * attached (uploaded receipts) — then only detach it, so nothing a user
     * filed is silently destroyed.
     */
    private function releasePayment(int $paymentId): void
    {
        $payment = Payment::find($paymentId);
        if (! $payment) {
            return;
        }
        if ($payment->documents()->exists()) {
            \Log::warning("Price schedule: kept payment #{$paymentId} (has documents) — only unlinked.");
            return;
        }
        $payment->delete();
    }

    /** Same guards as PaymentController::store — confirmed sale, no overpay. */
    private function createLinkedPayment(Request $request, Sale $sale, float $amount, ?string $date, ?string $method): ?Payment
    {
        if ($sale->status !== 'confirmed') {
            abort(422, 'Cannot mark an instalment paid until the sale is confirmed.');
        }
        if ($amount <= 0) {
            return null;
        }
        if ($amount > $sale->dueAmount() + 0.01) {
            abort(422, 'Marking this instalment paid would exceed the sale due amount.');
        }

        $payment = Payment::create([
            'sale_id' => $sale->id,
            'amount' => $amount,
            'date' => $date ?: now()->toDateString(),
            'method' => $method ?: 'Bank Transfer',
            'recorded_by' => $request->user()->id,
        ]);

        ActivityLog::record($request->user(), 'Payment Recorded', "{$sale->flat->flat_no} — {$amount} (schedule)");

        return $payment;
    }

    private function serialize(PriceSchedule $schedule, Sale $sale): array
    {
        return [
            'id' => $schedule->id,
            'sale_id' => $schedule->sale_id,
            'agreement_date' => optional($schedule->agreement_date)->toDateString(),
            'project_name' => $schedule->project_name,
            'project_address' => $schedule->project_address,
            'apartment_type' => $schedule->apartment_type,
            'apartment_facing' => $schedule->apartment_facing,
            'floor' => $schedule->floor,
            'size_sft' => $schedule->size_sft,
            'rate_per_sft' => $schedule->rate_per_sft,
            'terms' => $schedule->terms,
            'totals_overridden' => $schedule->totals_overridden,
            'lines' => $schedule->lines->map(fn ($l) => [
                'id' => $l->id,
                'sort' => $l->sort,
                'description' => $l->description,
                'line_type' => $l->line_type,
                'rate_per_sft' => $l->rate_per_sft,
                'amount' => $l->amount,
                'is_computed' => $l->is_computed,
            ])->values(),
            'installments' => $schedule->installments->map(fn ($i) => [
                'id' => $i->id,
                'sort' => $i->sort,
                'milestone' => $i->milestone,
                'term' => $i->term,
                'due_date' => optional($i->due_date)->toDateString(),
                'amount' => $i->amount,
                'status' => $i->status,
                'paid_on' => optional($i->paid_on)->toDateString(),
                'payment_id' => $i->payment_id,
                'note' => $i->note,
                'is_overdue' => $i->is_overdue,
            ])->values(),
            'grand_total' => $schedule->grandTotal(),
            'installments_total' => $schedule->installmentsTotal(),
            'totals_match' => $schedule->totalsMatch(),
            'sale' => [
                'id' => $sale->id,
                'sale_price' => (float) $sale->sale_price,
                'status' => $sale->status,
                'flat_no' => $sale->flat->flat_no ?? null,
            ],
        ];
    }
}
