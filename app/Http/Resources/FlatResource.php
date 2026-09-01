<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Roadmap Phase 11 — Employee Privacy, enforced HERE at the server.
 * The React prototype only hid "Sold By" in the UI (anyone could still see
 * it via DevTools). This resource never puts the sale detail into the JSON
 * response at all unless the requester is allowed to see it — that's the
 * actual security boundary.
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
            $canSeeSaleDetail = $sale && (!$user || !$user->isEmployee() || $sale->employee_id === $user->id);

            if ($canSeeSaleDetail) {
                $data['sale'] = [
                    'sold_by' => $sale->employee->name,
                    'employee_id' => $sale->employee_id,
                    'customer' => $sale->customer->name,
                    'date' => $sale->date,
                    'sale_price' => $sale->sale_price,
                ];
            } else {
                $data['sale'] = null; // deliberately withheld, not just hidden client-side
            }
        }

        return $data;
    }
}
