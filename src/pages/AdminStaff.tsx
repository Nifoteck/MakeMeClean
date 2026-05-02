import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, Users2, CheckCircle2, PauseCircle, UserCheck } from "lucide-react";
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
  postcode: string | null;
  role: string | null;
  active: boolean | null;
  notes: string | null;
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

  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [applicants, setApplicants] = useState<ApplicantLite[]>([]);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchStaff = async () => {
    setFetching(true);
    setError("");
    const { data, error: err } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setStaff([]);
      setFetching(false);
      return;
    }
    setStaff((data as Staff[]) ?? []);
    setFetching(false);
  };

  const fetchApplicantsLite = async () => {
    const { data } = await supabase.from("job_applications").select("id, first_name, last_name, email, role, status");
    const rows = (data as any[]) ?? [];
    setApplicants(
      rows
        .filter((r) => String(r.status) === "hired" || String(r.status) === "shortlisted")
        .map((r) => ({
          id: String(r.id),
          first_name: String(r.first_name ?? ""),
          last_name: String(r.last_name ?? ""),
          email: String(r.email ?? ""),
          role: String(r.role ?? ""),
          status: String(r.status ?? ""),
        }))
    );
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStaff();
      fetchApplicantsLite();
    }
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (q === "") return true;
      return (
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [staff, search]);

  const createFromApplicant = async () => {
    if (!selectedApplicantId) return;
    setCreating(true);
    setError("");
    const { data: app, error: appErr } = await supabase.from("job_applications").select("*").eq("id", selectedApplicantId).single();
    if (appErr || !app) {
      setError("Applicant not found");
      setCreating(false);
      return;
    }
    const { error: err } = await supabase.from("staff").insert({
      application_id: app.id,
      first_name: app.first_name,
      last_name: app.last_name,
      email: app.email,
      phone: app.phone,
      city: app.city,
      postcode: app.postcode,
      role: app.role,
      active: true,
    });
    if (err) {
      setError(err.message);
      setCreating(false);
      return;
    }
    setCreateOpen(false);
    setSelectedApplicantId("");
    setCreating(false);
    await fetchStaff();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("staff").update({ active }).eq("id", id);
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, active } : s)));
  };

  if (loading || roleLoading || fetching) {
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
      title="Staff"
      subtitle="Manage cleaners and internal staff"
      actions={
        <button onClick={() => setCreateOpen((v) => !v)} className="btn-primary inline-flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Add staff
        </button>
      }
    >

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: staff.length, icon: Users2, tone: "bg-slate-50 text-slate-700" },
          { label: "Active", value: staff.filter((s) => Boolean(s.active)).length, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Inactive", value: staff.filter((s) => !Boolean(s.active)).length, icon: PauseCircle, tone: "bg-gray-50 text-gray-700" },
          { label: "Eligible applicants", value: applicants.length, icon: UserCheck, tone: "bg-blue-50 text-blue-700" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card">
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold mb-2", tone)}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </div>
            <div className="text-2xl font-extrabold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {createOpen && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
          <p className="font-bold text-gray-900 mb-3">Create staff from applicant</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[240px]">
              <label className="label">Applicant</label>
              <select className="input-field" value={selectedApplicantId} onChange={(e) => setSelectedApplicantId(e.target.value)}>
                <option value="">Select applicant</option>
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>{a.first_name} {a.last_name} • {a.email} ({a.status})</option>
                ))}
              </select>
            </div>
            <button onClick={createFromApplicant} disabled={!selectedApplicantId || creating} className="btn-primary disabled:opacity-60">
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Tip: mark an applicant as “shortlisted” or “hired” to show here.</p>
        </div>
      )}

      <div className="card mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>
        <p className="text-xs text-gray-400 mt-3">{filtered.length} staff shown</p>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No staff yet.</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500">
            <div className="col-span-4">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2 text-right">Active</div>
          </div>
          {filtered.map((s) => (
            <div key={s.id} className="grid grid-cols-12 px-5 py-4 border-t border-gray-100 items-center">
              <div className="col-span-4">
                <p className="text-sm font-semibold text-gray-900">{s.first_name} {s.last_name}</p>
                <p className="text-xs text-gray-400">{s.city ?? "—"}{s.postcode ? `, ${s.postcode}` : ""}</p>
              </div>
              <div className="col-span-4 text-sm text-gray-700">{s.email}</div>
              <div className="col-span-2 text-sm text-gray-700">{s.role ?? "—"}</div>
              <div className="col-span-2 text-right">
                <button
                  onClick={() => toggleActive(s.id, !Boolean(s.active))}
                  className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded-lg border",
                    s.active ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {s.active ? "Active" : "Inactive"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
