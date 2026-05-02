import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, Users2, CheckCircle2, PauseCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";

interface Staff {
  id: string;
  application_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  role: string | null;
  active: boolean | null;
  created_at: string;
}

interface ApplicantLite {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
}

export default function AdminStaff() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [applicants, setApplicants] = useState<ApplicantLite[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchStaff = async () => {
    setFetching(true);
    const { data, error: err } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setStaff((data as Staff[]) ?? []);
    setFetching(false);
  };

  const fetchApplicants = async () => {
    const { data } = await supabase.from("job_applications").select("id, first_name, last_name, email, role, status");
    setApplicants(
      ((data as any[]) ?? [])
        .filter((r) => r.status === "hired" || r.status === "shortlisted")
        .map((r) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email, role: r.role, status: r.status }))
    );
  };

  useEffect(() => {
    if (isAdmin) { fetchStaff(); fetchApplicants(); }
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => q === "" || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.role ?? "").toLowerCase().includes(q));
  }, [staff, search]);

  const createFromApplicant = async () => {
    if (!selectedApplicantId) return;
    setCreating(true);
    const { data: app, error: appErr } = await supabase.from("job_applications").select("*").eq("id", selectedApplicantId).single();
    if (appErr || !app) { setError("Applicant not found"); setCreating(false); return; }
    const { error: err } = await supabase.from("staff").insert({
      application_id: app.id, first_name: app.first_name, last_name: app.last_name,
      email: app.email, phone: app.phone, city: app.city, role: app.role, active: true,
    });
    if (err) { setError(err.message); setCreating(false); return; }
    setAddOpen(false);
    setSelectedApplicantId("");
    setCreating(false);
    fetchStaff();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("staff").update({ active }).eq("id", id);
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, active } : s)));
  };

  if (loading || roleLoading || fetching) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Please log in.</p></div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">No admin access.</p></div>;

  return (
    <AdminLayout
      title="Staff"
      subtitle="Manage cleaners and internal staff"
      actions={
        <button onClick={() => setAddOpen((v) => !v)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <UserPlus className="w-4 h-4" /> Add staff
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total", value: staff.length },
          { label: "Active", value: staff.filter((s) => Boolean(s.active)).length },
          { label: "Inactive", value: staff.filter((s) => !Boolean(s.active)).length },
        ].map(({ label, value }) => (
          <div key={label} className="card py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-extrabold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

      {/* Add from applicant */}
      {addOpen && (
        <div className="card mb-4">
          <p className="font-semibold text-gray-900 text-sm mb-3">Add staff from applicant</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <select className="input-field" value={selectedApplicantId} onChange={(e) => setSelectedApplicantId(e.target.value)}>
                <option value="">Select applicant (shortlisted / hired)</option>
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>{a.first_name} {a.last_name} — {a.role} ({a.status})</option>
                ))}
              </select>
            </div>
            <button onClick={createFromApplicant} disabled={!selectedApplicantId || creating} className="btn-primary disabled:opacity-50">
              {creating ? "Adding..." : "Add"}
            </button>
            <button onClick={() => setAddOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 text-sm">No staff yet.</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-4">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          {filtered.map((s) => (
            <div key={s.id} className="grid grid-cols-12 px-5 py-4 border-t border-gray-100 items-center hover:bg-gray-50 transition-colors">
              <div className="col-span-4">
                <p className="text-sm font-semibold text-gray-900">{s.first_name} {s.last_name}</p>
                <p className="text-xs text-gray-400">{s.city ?? "—"}</p>
              </div>
              <div className="col-span-4 text-sm text-gray-600 truncate">{s.email}</div>
              <div className="col-span-2 text-sm text-gray-600">{s.role ?? "—"}</div>
              <div className="col-span-2 text-right">
                <button
                  onClick={() => toggleActive(s.id, !Boolean(s.active))}
                  className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                    s.active
                      ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {s.active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-3">{filtered.length} staff shown</p>
    </AdminLayout>
  );
}
