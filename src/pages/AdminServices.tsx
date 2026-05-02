import { useEffect, useState } from "react";
import { RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";
import type { DbService } from "@/lib/services";
import { serviceIcons } from "@/lib/services";
import { cn, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import { supabase } from "@/lib/supabase";
import AdminLayout from "@/components/admin/AdminLayout";

export default function AdminServices() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const [services, setServices] = useState<DbService[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<DbService>>({});

  const fetchServices = async () => {
    setFetching(true);
    setError("");
    const { data, error: err } = await supabase
      .from("services")
      .select("id, name, description, price, duration, icon_key, popular, active, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (err) {
      setError(err.message);
      setServices([]);
    } else {
      setServices((data as DbService[]) ?? []);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) fetchServices();
  }, [isAdmin]);

  const startEdit = (s?: DbService) => {
    setEditingId(s?.id ?? "__new__");
    setDraft(
      s
        ? { ...s }
        : { id: "", name: "", description: "", price: 0, duration: "", icon_key: "home", popular: false, active: true, sort_order: 0 }
    );
    setError("");
  };

  const save = async () => {
    if (!draft.id || !draft.name || !draft.description || !draft.duration) {
      setError("Please fill: id, name, description, duration.");
      return;
    }
    if (!draft.icon_key || !serviceIcons[draft.icon_key]) {
      setError("Please choose a valid icon.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      id: String(draft.id),
      name: String(draft.name),
      description: String(draft.description),
      price: Number(draft.price ?? 0),
      duration: String(draft.duration),
      icon_key: String(draft.icon_key),
      popular: Boolean(draft.popular),
      active: Boolean(draft.active),
      sort_order: Number(draft.sort_order ?? 0),
    };
    const { error: err } = await supabase.from("services").upsert(payload, { onConflict: "id" });
    if (err) setError(err.message);
    setSaving(false);
    setEditingId(null);
    await fetchServices();
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full card text-center">
          <p className="text-gray-600 font-semibold">Please log in to access admin.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full card text-center">
          <p className="text-gray-600 font-semibold">You don't have admin access.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      title="Services"
      subtitle="Add/edit services and pricing shown on the site"
      actions={<button onClick={() => startEdit()} className="btn-primary">New service</button>}
    >

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total services", value: services.length, icon: Sparkles, tone: "bg-slate-50 text-slate-700" },
          { label: "Active", value: services.filter((s) => Boolean(s.active)).length, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Popular", value: services.filter((s) => Boolean(s.popular)).length, icon: Sparkles, tone: "bg-green-50 text-green-700" },
          { label: "Inactive", value: services.filter((s) => !Boolean(s.active)).length, icon: RefreshCw, tone: "bg-gray-50 text-gray-700" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card">
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold mb-2", tone)}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </div>
            <div className="text-2xl font-extrabold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {editingId && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900">{editingId === "__new__" ? "Add service" : "Edit service"}</p>
              <button onClick={() => setEditingId(null)} className="text-sm font-semibold text-gray-500 hover:text-gray-700">Close</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">ID (slug)</label>
                <input className="input-field" value={draft.id ?? ""} onChange={(e) => setDraft((p) => ({ ...p, id: e.target.value }))} placeholder="deep-cleaning" />
              </div>
              <div>
                <label className="label">Name</label>
                <input className="input-field" value={draft.name ?? ""} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Deep Cleaning" />
              </div>
              <div className="md:col-span-2">
                <label className="label">Description</label>
                <textarea className="input-field resize-none" rows={3} value={draft.description ?? ""} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Price (£)</label>
                <input type="number" step="0.01" className="input-field" value={String(draft.price ?? 0)} onChange={(e) => setDraft((p) => ({ ...p, price: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="label">Duration</label>
                <input className="input-field" value={draft.duration ?? ""} onChange={(e) => setDraft((p) => ({ ...p, duration: e.target.value }))} placeholder="4–6 hours" />
              </div>
              <div>
                <label className="label">Icon</label>
                <select className="input-field" value={draft.icon_key ?? "home"} onChange={(e) => setDraft((p) => ({ ...p, icon_key: e.target.value }))}>
                  {Object.keys(serviceIcons).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sort order</label>
                <input type="number" className="input-field" value={String(draft.sort_order ?? 0)} onChange={(e) => setDraft((p) => ({ ...p, sort_order: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={Boolean(draft.popular)} onChange={(e) => setDraft((p) => ({ ...p, popular: e.target.checked }))} />
                  Popular
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={Boolean(draft.active)} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
                  Active
                </label>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500">
            <div className="col-span-3">ID</div>
            <div className="col-span-5">Name</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {services.map((s) => (
            <div key={s.id} className="grid grid-cols-12 px-5 py-4 border-t border-gray-100 items-center">
              <div className="col-span-3 text-sm font-mono text-gray-500">{s.id}</div>
              <div className="col-span-5">
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-400">{s.duration}{s.popular ? " • Popular" : ""}{s.active ? "" : " • Inactive"}</p>
              </div>
              <div className="col-span-2 text-right text-sm font-bold text-gray-900">{formatCurrency(Number(s.price))}</div>
              <div className="col-span-2 text-right">
                <button onClick={() => startEdit(s)} className="text-sm font-semibold text-green-700 hover:underline">Edit</button>
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <div className="px-5 py-10 text-center text-gray-400">No services found.</div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
