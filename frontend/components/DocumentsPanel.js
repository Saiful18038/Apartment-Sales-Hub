"use client";

import { useRef, useState } from "react";
import { Download, Trash2, Upload, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { fmtDateTime } from "@/lib/format";
import { Btn, ErrorBanner, EmptyState, LoadingBlock, inputCls } from "@/components/ui";

const CATEGORIES = ["Agreement", "NID", "Photo", "Receipt", "Other"];

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Roadmap Phase 14 — Document Management. Attaches to any of the
 * documentable types the API supports: project, customer, booking, sale,
 * payment. Access is enforced server-side (DocumentController) — this
 * component just renders whatever the API allows the current user to see.
 */
export default function DocumentsPanel({ documentableType, documentableId }) {
  const path = `/documents?documentable_type=${documentableType}&documentable_id=${documentableId}`;
  const { data: documents, loading, error, refetch } = useApi(path);
  const [category, setCategory] = useState("Other");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("documentable_type", documentableType);
      form.append("documentable_id", documentableId);
      form.append("category", category);
      form.append("file", file);
      await api.postForm("/documents", form);
      refetch();
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = (doc) => {
    api.download(`/documents/${doc.id}/download`, doc.original_filename).catch((err) => alert(err.message || "Download failed."));
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.original_filename}"?`)) return;
    try {
      await api.del(`/documents/${doc.id}`);
      refetch();
    } catch (err) {
      alert(err.message || "Delete failed.");
    }
  };

  return (
    <div className="space-y-3">
      <ErrorBanner message={error} />
      <ErrorBanner message={uploadError} />

      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} flex-1 min-w-[120px] sm:w-[140px] sm:flex-none`} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
        <Btn size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload size={13} /> {uploading ? "Uploading…" : "Upload"}
        </Btn>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : documents.length === 0 ? (
        <EmptyState text="No documents attached yet" />
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate">{doc.original_filename}</div>
                  <div className="text-[11px] text-slate-400">
                    {doc.category} · {fmtSize(doc.size_bytes)} · {doc.uploader?.name || "Unknown"} · {fmtDateTime(doc.created_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => handleDownload(doc)} className="text-slate-400 hover:text-slate-600 p-1"><Download size={14} /></button>
                <button onClick={() => handleDelete(doc)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
