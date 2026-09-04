"use client";

import { PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { useApi } from "@/lib/useApi";
import { fmtBDT } from "@/lib/format";

/**
 * dataviz skill — categorical palette, fixed hue order (never cycled/re-
 * sorted per-chart), validated for both adjacent- and all-pairs CVD/normal-
 * vision separation (node scripts/validate_palette.js, 6 slots, all PASS).
 * Three of these six sit under 3:1 contrast on a white surface (aqua/
 * yellow/magenta) — the skill's "relief rule" for that WARN is direct
 * labels on every slice plus a legend, both present below, never color
 * alone.
 *
 * Shared between the Reports page (all-teams breakdown, and a per-team
 * member breakdown inside its Individual Team Performance modal) and the
 * Dashboard (the same all-teams breakdown, below Flat Status Breakdown).
 */
export const PIE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];
const RADIAN = Math.PI / 180;

/**
 * recharts' `label` prop, when a function, must return an SVG node itself
 * (a bare string renders nothing) — this is the standard positioned-<text>
 * pattern, placed just outside outerRadius along the slice's mid-angle.
 */
function renderSliceLabel({ cx, cy, midAngle, outerRadius, percent, name }) {
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#475569" fontSize={11} fontWeight={600} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central">
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/**
 * Part-to-whole "at a glance" only (dataviz skill: pie is fine for that,
 * bad past ~6 segments) — beyond 5 rows the smallest ones fold into a
 * fixed grey "Other" slice rather than adding a 7th generated hue.
 */
export function toPieSlices(rows, nameKey, valueKey) {
  const sorted = rows
    .map((r) => ({ name: r[nameKey], value: Number(r[valueKey]) || 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= 5) return sorted;
  const head = sorted.slice(0, 5);
  const otherTotal = sorted.slice(5).reduce((a, s) => a + s.value, 0);
  return otherTotal > 0 ? [...head, { name: "Other", value: otherTotal }] : head;
}

export function TeamPieChart({ title, slices, formatValue }) {
  const total = slices.reduce((a, s) => a + s.value, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <PieChartIcon size={15} className="text-[#1F3864]" />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {total === 0 ? (
        <div className="text-center text-sm text-slate-400 italic py-14">No data yet</div>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <PieChart margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={0}
                outerRadius={65}
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="#fff"
                strokeWidth={2}
                label={renderSliceLabel}
                labelLine={{ stroke: "#CBD5E1" }}
                isAnimationActive={false}
              >
                {slices.map((s, i) => (
                  <Cell key={s.name} fill={s.name === "Other" ? "#94A3B8" : PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatValue(value)}
                contentStyle={{ borderRadius: 12, border: "1px solid #EEF1F6", boxShadow: "0 8px 24px -8px rgba(15,23,42,0.15)", fontSize: 12.5, padding: "8px 12px" }}
              />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/**
 * Owner's request: "Total Revenue by Team" + "Total Booking by Team" pie
 * charts, dropped in wherever a team-level revenue/booking breakdown is
 * useful (Reports page, and below Flat Status Breakdown on the
 * Dashboard) — fetches /reports/team-summary itself so callers don't need
 * to wire that up separately.
 */
export default function TeamRevenueBookingPies() {
  const { data: teamData, loading } = useApi("/reports/team-summary");
  const teamRows = teamData?.teams || [];

  if (loading || teamRows.length === 0) return null;

  const revenueSlices = toPieSlices(teamRows, "team", "total_revenue");
  const bookingSlices = toPieSlices(teamRows, "team", "total_booking");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <TeamPieChart title="Total Revenue by Team" slices={revenueSlices} formatValue={fmtBDT} />
      <TeamPieChart title="Total Booking by Team" slices={bookingSlices} formatValue={(v) => `${v} booking${v === 1 ? "" : "s"}`} />
    </div>
  );
}
