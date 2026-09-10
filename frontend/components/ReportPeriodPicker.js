"use client";

import { inputCls } from "@/components/ui";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Human label for a {year, month} period — month 0 means the whole year. */
export function periodLabel(year, month) {
  if (!year) return "All time";
  return month ? `${MONTHS[month - 1]} ${year}` : `Year ${year}`;
}

/**
 * Year + Month selector shared by the Reports summary and the Individual
 * Team Performance page. `month` of 0 is "whole year". `years` is the list
 * offered in the Year dropdown (from /reports/team-summary); the current
 * `year` is added in case it isn't in that list yet.
 */
export default function ReportPeriodPicker({ year, month, years = [], onYear, onMonth }) {
  const yearOptions = Array.from(new Set([year, ...years])).filter(Boolean).sort((a, b) => b - a);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="block text-xs font-medium text-slate-500 mb-1">Year</span>
        <select className={`${inputCls} w-[120px]`} value={year} onChange={(e) => onYear(Number(e.target.value))}>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-slate-500 mb-1">Month</span>
        <select className={`${inputCls} w-[160px]`} value={month} onChange={(e) => onMonth(Number(e.target.value))}>
          <option value={0}>Whole year</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </label>
    </div>
  );
}
