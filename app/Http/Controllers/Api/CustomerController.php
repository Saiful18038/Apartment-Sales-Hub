<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        return Customer::visibleTo($request->user())
            ->with(['interestedProject', 'interestedFlat', 'assignedEmployee'])
            ->latest()
            ->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        // Employees can only create customers assigned to themselves.
        if ($request->user()->isEmployee()) {
            $data['assigned_employee_id'] = $request->user()->id;
        }
        $customer = Customer::create($data);
        ActivityLog::record($request->user(), 'Customer Added', $customer->name);
        return response()->json($customer, 201);
    }

    public function update(Request $request, Customer $customer)
    {
        if ($request->user()->isEmployee() && $customer->assigned_employee_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden — not your customer.'], 403);
        }
        $data = $this->validated($request, true);
        $customer->update($data);
        ActivityLog::record($request->user(), 'Customer Updated', $customer->name);
        return response()->json($customer);
    }

    private function validated(Request $request, bool $isUpdate = false): array
    {
        $rule = $isUpdate ? 'sometimes' : 'required';
        return $request->validate([
            'name' => "$rule|string|max:255",
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'nid' => 'nullable|string|max:100',
            'reference_source' => 'nullable|string|max:100',
            'interested_project_id' => 'nullable|exists:projects,id',
            'interested_flat_id' => 'nullable|exists:flats,id',
            'assigned_employee_id' => 'nullable|exists:users,id',
            'status' => 'nullable|in:New,Interested,Follow-up,Negotiation,Booked,Sold,Lost',
            'follow_up_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);
    }
}
