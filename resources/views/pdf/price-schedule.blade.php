@php
    $tk = fn ($n) => 'TK ' . number_format((float) $n, 2);
    $lines = $schedule->lines;
    $installments = $schedule->installments;
    $rowLabel = [
        'item' => '', 'rebate' => '', 'subtotal' => 'Sub Total',
        'revised_subtotal' => 'Revised Sub Total', 'total' => 'Total',
    ];
@endphp
<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 11px; color: #000; margin: 0; }
        h1 { font-size: 15px; margin: 0; text-align: center; }
        h2 { font-size: 12px; margin: 2px 0 0; text-align: center; text-decoration: underline; }
        .company { text-align: center; font-size: 13px; font-weight: bold; }
        .sub { text-align: center; font-size: 10px; }
        .date { text-align: right; font-style: italic; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        .band td { background: #e8e8e8; font-weight: bold; border: 1px solid #000; padding: 3px 6px; }
        .grid td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
        .num { text-align: right; white-space: nowrap; }
        .strong td { font-weight: bold; }
        .muted { color: #333; }
        .mt { margin-top: 10px; }
        .notes { margin-top: 12px; font-size: 10px; }
        .notes div { margin-bottom: 3px; }
        .sign { margin-top: 44px; text-align: right; }
        .sign .line { display: inline-block; border-top: 1px solid #000; padding-top: 3px; width: 200px; text-align: center; font-weight: bold; }
    </style>
</head>
<body>
    <div class="company">{{ $schedule->project_name ? 'Asset Developments & Holdings Ltd' : config('app.name') }}</div>
    <div class="sub">Final Price &amp; Payment Schedule of Apartment</div>
    <h2>&nbsp;</h2>
    <div class="date">{{ optional($schedule->agreement_date)->format('d-M-y') }}</div>

    <table class="mt">
        <tr class="band"><td colspan="2">Project Details</td></tr>
    </table>
    <table class="grid">
        <tr><td width="35%">Name</td><td>{{ $schedule->project_name }}</td></tr>
        <tr><td>Address</td><td>{{ $schedule->project_address }}</td></tr>
    </table>

    <table class="mt">
        <tr class="band"><td colspan="2">Apartment Details</td></tr>
    </table>
    <table class="grid">
        <tr><td width="35%">Type</td><td>{{ $schedule->apartment_type }}</td></tr>
        <tr><td>Face</td><td>{{ $schedule->apartment_facing }}</td></tr>
        <tr><td>Size</td><td>{{ $schedule->size_sft ? number_format((float) $schedule->size_sft, 2) . ' SFT.' : '' }}</td></tr>
        <tr><td>Floor</td><td>{{ $schedule->floor }}</td></tr>
    </table>

    <table class="mt">
        <tr class="band"><td colspan="3">Price</td></tr>
    </table>
    <table class="grid">
        @foreach ($lines as $line)
            <tr class="{{ in_array($line->line_type, ['subtotal','revised_subtotal','total']) ? 'strong' : '' }}">
                <td width="55%">
                    @if ($line->line_type === 'rebate') Less: @endif{{ $line->description }}
                </td>
                <td width="20%" class="num muted">
                    @if ($line->rate_per_sft) {{ number_format((float) $line->rate_per_sft, 2) }} /sft @endif
                </td>
                <td width="25%" class="num">
                    @if ($line->line_type === 'rebate') ({{ $tk($line->amount) }}) @else {{ $tk($line->amount) }} @endif
                </td>
            </tr>
        @endforeach
    </table>

    <table class="mt">
        <tr class="band"><td colspan="4">Payment Schedule</td></tr>
    </table>
    <table class="grid">
        @foreach ($installments as $i)
            <tr>
                <td width="42%">{{ $i->milestone }}</td>
                <td width="16%">{{ $i->term }}</td>
                <td width="22%">{{ optional($i->due_date)->format('jS F Y') }}</td>
                <td width="20%" class="num">{{ $tk($i->amount) }}</td>
            </tr>
        @endforeach
        <tr class="strong">
            <td colspan="3" class="num">Total TK</td>
            <td class="num">{{ number_format($schedule->installmentsTotal(), 2) }}</td>
        </tr>
    </table>

    @if ($schedule->terms)
        <div class="notes">
            @foreach (preg_split('/\r\n|\r|\n/', $schedule->terms) as $t)
                @if (trim($t) !== '')<div>** {{ $t }}</div>@endif
            @endforeach
        </div>
    @endif

    <div class="sign"><span class="line">Allottee</span></div>
</body>
</html>
