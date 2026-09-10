"use client";

import { useRef, useState } from "react";
import {
  UploadCloud, FileSpreadsheet, Eye, Check, AlertTriangle, X,
  Building2, Home, Layers, SkipForward, PartyPopper,
} from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui";

/**
 * Owner uploads the "PRICE & AVAILABILITY CHART" .xlsx (or a reviewed
 * .csv) and the app builds the Zones / Projects / Flats — same parse +
 * import as the chart:extract / chart:import commands, over one request
 * (POST /api/chart/import, dry_run toggles preview vs write).
 */
const STEPS = ["Choose file", "Preview", "Import"];

function prettySize(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ChartImport({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [done, setDone] = useState(null);

  const step = done ? 2 : preview ? 2 : file ? 1 : 0;

  const pick = (f) => {
    if (!f) return;
    const ok = /\.(xlsx|xls|csv)$/i.test(f.name);
    setError(ok ? "" : "Only .xlsx or .csv files.");
    if (!ok) return;
    setFile(f);
    setPreview(null);
    setDone(null);
  };

  const send = async (dryRun) => {
    if (!file) return;
    setBusy(dryRun ? "preview" : "import");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dry_run", dryRun ? "1" : "0");
      const res = await api.postForm("/chart/import", fd);
      if (dryRun) { setPreview(res); setDone(null); }
      else { setDone(res); onImported?.(); }
    } catch (e) {
      setError(e.message || "Upload failed.");
    } finally {
      setBusy("");
    }
  };

  const payload = done || preview;
  const r = payload?.result;
  const stats = payload?.parse_stats || {};
  const warnings = payload?.warnings || [];
  const warningCount = payload?.warning_count || 0;

  return (
    <Modal title="Import from Excel" onClose={onClose} wide>
      <div className="space-y-5">
        {/* stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
              <div
                className={`flex items-center gap-2 text-xs font-semibold ${
                  i <= step ? "text-[#1F3864]" : "text-slate-300"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full grid place-items-center text-[11px] border-2 ${
                    i < step
                      ? "bg-[#1F3864] border-[#1F3864] text-white"
                      : i === step
                      ? "border-[#1F3864] text-[#1F3864]"
                      : "border-slate-200 text-slate-300"
                  }`}
                >
                  {i < step ? <Check size={12} /> : i + 1}
                </span>
                <span className="hidden sm:block">{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 rounded-full ${i < step ? "bg-[#1F3864]" : "bg-slate-100"}`} />
              )}
            </div>
          ))}
        </div>

        {!done && (
          <>
            {/* drop zone / file card */}
            {!file ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}
                className={`w-full rounded-2xl border-2 border-dashed px-6 py-10 flex flex-col items-center gap-3 transition-colors ${
                  dragOver ? "border-[#1F3864] bg-[#1F3864]/5" : "border-slate-200 hover:border-slate-300 bg-slate-50/60"
                }`}
              >
                <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#28477a] to-[#1F3864] grid place-items-center text-white shadow-lg shadow-[#1F3864]/25">
                  <UploadCloud size={26} />
                </span>
                <span className="text-sm font-semibold text-slate-700">Drag your chart here, or click to browse</span>
                <span className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">.xlsx</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">.csv</span>
                  <span>up to 20&nbsp;MB</span>
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center shrink-0">
                  <FileSpreadsheet size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{file.name}</div>
                  <div className="text-[11px] text-slate-400">{prettySize(file.size)}</div>
                </div>
                <button
                  onClick={() => { setFile(null); setPreview(null); setDone(null); }}
                  className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-100"
                  title="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            {/* actions */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => send(true)}
                disabled={!file || busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                <Eye size={15} /> {busy === "preview" ? "Reading…" : preview ? "Re-check" : "Preview"}
              </button>
              <button
                onClick={() => send(false)}
                disabled={!file || busy || !preview}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#e0ac2b] to-[#B7860B] px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-[#B7860B]/30 hover:shadow-md hover:brightness-110 disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
              >
                <UploadCloud size={15} /> {busy === "import" ? "Importing…" : "Import for real"}
              </button>
              {file && !preview && (
                <span className="text-xs text-slate-400">Preview first — nothing is written until you confirm.</span>
              )}
            </div>
          </>
        )}

        {/* result */}
        {payload && (
          <div className="space-y-4">
            {done && (
              <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-4 text-white shadow-lg shadow-emerald-600/25">
                <PartyPopper size={26} className="shrink-0" />
                <div>
                  <div className="font-bold">Import complete</div>
                  <div className="text-xs text-white/85">
                    {r.zones_created} zones · {r.projects_created} projects · {r.flats_created} flats added
                  </div>
                </div>
              </div>
            )}

            {!done && (
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Preview — nothing written yet
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile icon={Layers} label="Zones" value={r.zones_created} from="#4f46e5" to="#3730a3" />
              <Tile icon={Building2} label="Projects" value={r.projects_created} from="#2563eb" to="#1d4ed8" />
              <Tile icon={Home} label="Flats" value={r.flats_created} from="#059669" to="#047857" />
              <Tile icon={SkipForward} label="Skipped" value={r.flats_skipped} from="#64748b" to="#334155" />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              {stats.no_price != null && <span>{stats.no_price} flats have no price in the chart</span>}
              {stats.amenity_skipped != null && <span>{stats.amenity_skipped} amenity cells skipped</span>}
              {r.status_defaulted > 0 && <span>{r.status_defaulted} defaulted to “Available”</span>}
            </div>

            {r.tree?.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="text-left font-semibold text-slate-500 uppercase tracking-wide px-3 py-2">Zone</th>
                        <th className="text-left font-semibold text-slate-500 uppercase tracking-wide px-3 py-2">Project</th>
                        <th className="text-right font-semibold text-slate-500 uppercase tracking-wide px-3 py-2">Flats</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {r.tree.map((n, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="px-3 py-1.5 text-slate-500">{n.zone}</td>
                          <td className="px-3 py-1.5 text-slate-800 font-medium">
                            {n.project}
                            {n.new && (
                              <span className="ml-1.5 text-[10px] font-bold text-emerald-600 uppercase">new</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{n.flats}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {warningCount > 0 && (
              <details className="group rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
                <summary className="cursor-pointer list-none px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <AlertTriangle size={14} />
                  {warningCount} cell{warningCount === 1 ? "" : "s"} need a human eye
                  <span className="ml-auto text-amber-500 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <ul className="px-4 pb-3 space-y-0.5 max-h-40 overflow-y-auto text-[11px] text-amber-900/80">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-mono text-amber-700">{w.cell}</span> — {w.msg}
                    </li>
                  ))}
                  {warningCount > warnings.length && (
                    <li className="text-amber-600">… +{warningCount - warnings.length} more</li>
                  )}
                </ul>
              </details>
            )}

            {done && (
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-[#28477a] to-[#1F3864] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  <Check size={15} /> Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Tile({ icon: Icon, label, value, from, to }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-3.5 shadow-premium"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <div className="pointer-events-none absolute -right-4 -top-6 w-20 h-20 rounded-full bg-white/10" />
      <div className="relative flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/80">{label}</span>
        <Icon size={15} className="text-white/80" />
      </div>
      <div className="relative text-2xl font-bold text-white mt-1 tabular-nums">{value ?? "—"}</div>
    </div>
  );
}
