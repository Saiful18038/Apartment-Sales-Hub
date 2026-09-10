@php
    $num = fn ($n) => round((float) $n, 2);
@endphp
<table>
    <tr><td colspan="4"><strong>Final Price &amp; Payment Schedule of Apartment</strong></td></tr>
    <tr><td colspan="4">{{ optional($schedule->agreement_date)->format('d-M-Y') }}</td></tr>
    <tr><td colspan="4"></td></tr>

    <tr><td colspan="4"><strong>Project Details</strong></td></tr>
    <tr><td>Name</td><td colspan="3">{{ $schedule->project_name }}</td></tr>
    <tr><td>Address</td><td colspan="3">{{ $schedule->project_address }}</td></tr>
    <tr><td colspan="4"></td></tr>

    <tr><td colspan="4"><strong>Apartment Details</strong></td></tr>
    <tr><td>Type</td><td colspan="3">{{ $schedule->apartment_type }}</td></tr>
    <tr><td>Face</td><td colspan="3">{{ $schedule->apartment_facing }}</td></tr>
    <tr><td>Size (SFT)</td><td colspan="3">{{ $schedule->size_sft ? $num($schedule->size_sft) : '' }}</td></tr>
    <tr><td>Floor</td><td colspan="3">{{ $schedule->floor }}</td></tr>
    <tr><td colspan="4"></td></tr>

    <tr><td colspan="4"><strong>Price</strong></td></tr>
    <tr><td><strong>Description</strong></td><td><strong>Rate / SFT</strong></td><td></td><td><strong>Amount (TK)</strong></td></tr>
    @foreach ($schedule->lines as $line)
        <tr>
            <td>{{ $line->line_type === 'rebate' ? 'Less: ' : '' }}{{ $line->description }}</td>
            <td>{{ $line->rate_per_sft ? $num($line->rate_per_sft) : '' }}</td>
            <td></td>
            <td>{{ $line->line_type === 'rebate' ? -$num($line->amount) : $num($line->amount) }}</td>
        </tr>
    @endforeach
    <tr><td colspan="4"></td></tr>

    <tr><td colspan="4"><strong>Payment Schedule</strong></td></tr>
    <tr>
        <td><strong>Milestone</strong></td><td><strong>Term</strong></td>
        <td><strong>Due Date</strong></td><td><strong>Amount (TK)</strong></td>
    </tr>
    @foreach ($schedule->installments as $i)
        <tr>
            <td>{{ $i->milestone }}</td>
            <td>{{ $i->term }}</td>
            <td>{{ optional($i->due_date)->format('d-M-Y') }}</td>
            <td>{{ $num($i->amount) }}</td>
        </tr>
    @endforeach
    <tr>
        <td colspan="3"><strong>Total</strong></td>
        <td><strong>{{ $num($schedule->installmentsTotal()) }}</strong></td>
    </tr>

    @if ($schedule->terms)
        <tr><td colspan="4"></td></tr>
        @foreach (preg_split('/\r\n|\r|\n/', $schedule->terms) as $t)
            @if (trim($t) !== '')<tr><td colspan="4">** {{ $t }}</td></tr>@endif
        @endforeach
    @endif
</table>
