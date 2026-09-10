/**
 * A "unit" is one vertical apartment line within a project — the flat_no
 * code with its parenthesised floor suffix removed. Chart imports write
 * flat_no as "<unit> (<ordinal>)" (e.g. "A-1472 (9th)", "AB-2972 (3rd)",
 * "A (9th)"), so the unit is everything before that "(9th)" part.
 * Manually-typed flat numbers with no such suffix fall back to their
 * leading letters ("A9" -> "A").
 *
 * A project with two or three of these lines (see EMBASSY SQUARE with
 * A-1472 / B-1472 / AB-2972, or CROWN MANOR with A-2471 / B-2484) is shown
 * as side-by-side unit columns on the Flats and Projects screens instead
 * of stacking every flat of a floor into one row. This mirrors the owner's
 * hand-made availability chart, where each unit already has its own column
 * of per-floor prices. The API's Project::unitBreakdown() is the
 * server-side twin of this logic — keep the two in step.
 */
export function unitLabel(flatNo) {
  const s = String(flatNo ?? "").trim();
  if (!s) return "";
  const paren = s.match(/^(.*?)\s*\([^)]*\)\s*$/);
  if (paren && paren[1].trim()) return paren[1].trim().toUpperCase();
  const lead = s.match(/^([A-Za-z]+)/);
  if (lead) return lead[1].toUpperCase();
  return s.toUpperCase();
}

/**
 * Distinct unit labels across `flats`, in first-seen order. /api/flats
 * comes back ordered by floor descending, so the first flats seen are the
 * top floor's — and their order there is the insertion order the chart
 * import used, i.e. the chart's left-to-right column order.
 */
export function projectUnits(flats) {
  const seen = [];
  for (const f of flats || []) {
    const u = unitLabel(f.flat_no);
    if (u && !seen.includes(u)) seen.push(u);
  }
  return seen;
}
