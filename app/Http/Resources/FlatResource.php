<?php

namespace App\Http\Resources;

use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Roadmap Phase 11 — Employee Privacy, enforced HERE at the server.
 * The React prototype only hid "Sold By" in the UI (anyone could still see
 * it via DevTools). This resource never puts the sale detail into the JSON
 * response at all unless the requester is allowed to see it — that's the
 * actual security boundary.
 *
 * Team hierarchy extension (owner's request): a Sold Out flat's details are
 * visible to Owner/Admin, to the specific employee who made the sale, and
 * to THAT employee's Team Leader — but not to any other Team Leader. See
 * canViewSale() below; mirrors Sale::scopeVisibleTo's same rule for the
 * Sales list page.
 */
class FlatResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'floor' => $this->floor,
            'flat_no' => $this->flat_no,
            'size_sft' => $this->size_sft,
            'price_per_sft' => $this->price_per_sft,
            'parking_charge' => $this->parking_charge,
            'parking_count' => $this->parking_count,
            'parking_number' => $this->parking_number,
            'utility_charge' => $this->utility_charge,
            'reserve_fund' => $this->reserve_fund,
            'facing' => $this->facing,
            'bedroom' => $this->bedroom,
            'bathroom' => $this->bathroom,
            'balcony' => $this->balcony,
            'status_code' => $this->status_code,
            'notes' => $this->notes,
            'sub_total' => $this->calcSubTotal(),
        ];

        if (in_array($this->status_code, ['SOLD_CR', 'SOLD_OS_SS'], true)) {
            $sale = $this->confirmedSale;
            $user = $request->user();

            if ($sale && self::canViewSale($user, $sale)) {
                $customer = $sale->customer;
                $leader = $sale->employee->team?->leader;

                $data['sale'] = [
                    'sold_by' => $sale->employee->name,
                    'employee_id' => $sale->employee_id,
                    'customer' => $customer->name,
                    // "Generate hoba" — there's no separate customer_code
                    // column; the auto-increment id already is the
                    // auto-generated identity, just formatted for display.
                    'customer_id' => 'CUST-' . str_pad((string) $customer->id, 5, '0', STR_PAD_LEFT),
                    'client_reference' => $customer->reference_source,
                    'date' => $sale->date,
                    'price_per_sft' => $this->price_per_sft,
                    'sold_price_per_sft' => $sale->sold_price_per_sft,
                    'sale_price' => $sale->sale_price,
                    'team_leader' => $leader?->name,
                    'team_member' => $sale->employee->name,
                ];
            } else {
                $data['sale'] = null; // deliberately withheld, not just hidden client-side
            }
        }

        return $data;
    }

    /**
     * Owner: "Sold out flat details — only Owner, Admin, and the Team
     * Leader whose member sold it can see it; no other Team Leader can."
     */
    private static function canViewSale(?User $user, Sale $sale): bool
    {
        if (!$user) {
            return false;
        }
        if ($user->canManage()) {
            return true;
        }
        if ($user->isTeamLeader()) {
            return $sale->employee->team_id !== null && $sale->employee->team_id === $user->team_id;
        }
        return $sale->employee_id === $user->id;
    }
}
