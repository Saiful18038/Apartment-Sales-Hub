"use client";

import { useState } from "react";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState } from "@/components/ui";

export default function ZonesPage() {
  const { user } = useAuth();
  const canEdit = user.role === "owner" || user.role === "admin";
  const { data: zones, loading, error, refetch } = useApi("/zones");

  const [modal, setModal] = useState(null); // "new" | zone.id | null
  const [name, setName] = useState("");
  const [saveError, setSaveError] = useState("");

  const openNew = () => { setName(""); setSaveError(""); setModal("new"); };
  const openEdit = (z) => { setName(z.name); setSaveError(""); setModal(z.id); };

  const save = async () => {
    if (!name.trim()) return;
    try {
      if (modal === "new") await api.post("/zones", { name: name.trim() });
      else await api.put(`/zones/${modal}`, { name: name.trim() });
      setModal(null);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Save failed.");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this zone? Projects and flats under it will also be removed.")) return;
    try {
      await api.del(`/zones/${id}`);
      refetch();
    } catch (e) {
      alert(e.message || "Delete failed.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Zones">
        {canEdit && <Btn onClick={openNew}><Plus size={15} /> Add Zone</Btn>}
      </PageHeader>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {zones.map((z) => (
            <div key={z.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-[#1F3864]/10 text-[#1F3864] flex items-center justify-center">
                    <MapPin size={17} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{z.name}</div>
                    <div className="text-xs text-slate-400">{z.projects_count ?? 0} projects</div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(z)} className="text-slate-400 hover:text-slate-600">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => remove(z.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {zones.length === 0 && <EmptyState text="No zones yet" />}
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Zone" : "Edit Zone"} onClose={() => setModal(null)}>
          <ErrorBanner message={saveError} />
          <Field label="Zone Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gulshan" />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
