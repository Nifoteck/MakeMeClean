import { useEffect, useMemo, useState } from "react";
import { Search, Download, Clock3, CheckCircle2, XCircle, Users2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";

type ApplicationStatus = "pending" | "reviewing" | "shortlisted" | "rejected" | "hired";

interface JobApplication {
  id: string;
  role: string;
  employment_type: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  created_at: string;
  cv_url?: string | null;
  id_proof_url?: string | null;
  rtw_doc_url?: string | null;
  dbs_cert_url?: string | null;
  [key: string]: unknown;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  reviewing: "bg-blue-100 text-blue-700",
  shortlisted: "bg-purple-100 text-purple-700",
  hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminApplicants() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");

  const fetchApplicants = async () => {
    setFetching(true);
    const { data, error: err } = await supabase.from("job_applications").select("*").order("created_at", { ascending: false });
    if (err) { setError(err.message); setApplications([]); }
    else setApplications((data as JobApplication[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (isAdmin) fetchApplicants(); }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      const matchSearch = q === "" || `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.role ?? "").toLowerCase().includes(q);
      return matchSearch && (statusFilter === "all" || a.status === statusFilter);
    });
  }, [applications, search, statusFilter]);

  const selected = useMemo(() => applications.find((a) => a.id === selectedId) ?? null, [applications, selectedId]);

  const updateApplicant = async (id: string, patch: { status?: ApplicationStatus; admin_notes?: string | null }) => {
    setSaving(true);
    setError("");
    if (patch.status === "hired") {
      const { data, error: fnErr } = await supabase.functions.invoke("hire-applicant", { body: { applicationId: id } });
      if (fnErr || !data?.ok) { setError(fnErr?.message ?? data?.error ?? "Failed to hire"); setSaving(false); return; }
      await fetchApplicants();
      setSaving(false);
      return;
    }
    const { error: err } = await supabase.from("job_applications").update(patch).eq("id", id);
    if (err) setError(err.message);
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setSaving(false);
  };

  const exportCSV = () => {
    const rows = [
      ["Date", "Status", "Role", "Name", "Email", "Phone", "City"],
      ...filtered.map((a) => [a.created_at, a.status, a.role, `${a.first_name} ${a.last_name}`, a.email, a.phone, a.city ?? ""]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "applicants.csv";
    a.click();
  };

  if (loading || roleLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Please log in.</p></div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">No admin access.</p></div>;

  return (
    <AdminLayout
      title="Applicants"
      subtitle="Recruitment pipeline"
      actions={
        <button onClick={exportCSV} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Download className="w-4 h-4" /> Export
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: applications.length, icon: Users2 },
          { label: "Pending", value: applications.filter((a) => a.status === "pending").length, icon: Clock3 },
          { label: "Hired", value: applications.filter((a) => a.status === "hired").length, icon: CheckCircle2 },
          { label: "Rejected", value: applications.filter((a) => a.status === "rejected").length, icon: XCircle },
        ].map(({ label, value }) => (
          <div key={label} className="card py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-extrabold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "pending", "reviewing", "shortlisted", "hired", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Split view */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {fetching ? (
            <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="card text-center py-12 text-gray-400 text-sm">No applicants found</div>
          ) : filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={cn("card w-full text-left transition-all hover:border-green-200", selectedId === a.id && "border-green-300 ring-1 ring-green-100")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.first_name} {a.last_name}</p>
                  <p className="text-xs text-gray-500 truncate">{a.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.role}</p>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0", STATUS_STYLES[a.status])}>
                  {a.status}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString("en-GB")}</p>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card text-center py-16 text-gray-400 text-sm">Select an applicant to view details</div>
          ) : (
            <div className="card space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">{selected.first_name} {selected.last_name}</h2>
                  <p className="text-sm text-gray-500">{selected.email} · {selected.phone}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{selected.role}{selected.employment_type ? ` · ${selected.employment_type}` : ""}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Status</label>
                  <select
                    className="input-field text-sm"
                    value={selected.status}
                    disabled={saving}
                    onChange={(e) => updateApplicant(selected.id, { status: e.target.value as ApplicationStatus })}
                  >
                    {(["pending", "reviewing", "shortlisted", "hired", "rejected"] as const).map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-gray-100" />

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Admin notes</label>
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  value={selected.admin_notes ?? ""}
                  disabled={saving}
                  onChange={(e) => {
                    const v = e.target.value;
                    setApplications((prev) => prev.map((a) => (a.id === selected.id ? { ...a, admin_notes: v } : a)));
                  }}
                  onBlur={() => {
                    const current = applications.find((a) => a.id === selected.id)?.admin_notes ?? "";
                    updateApplicant(selected.id, { admin_notes: current });
                  }}
                  placeholder="Add notes about this applicant..."
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Documents</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["CV", selected.cv_url],
                    ["ID proof", selected.id_proof_url],
                    ["Right to work", selected.rtw_doc_url],
                    ["DBS certificate", selected.dbs_cert_url],
                  ] as const).map(([label, url]) => (
                    <a
                      key={label}
                      href={url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className={cn("px-3 py-2 rounded-xl border text-sm font-medium text-center",
                        url ? "border-green-200 text-green-700 hover:bg-green-50" : "border-gray-100 text-gray-400 pointer-events-none")}
                    >
                      {label}{!url && <span className="text-xs font-normal"> (none)</span>}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">{filtered.length} of {applications.length} applicants</p>
    </AdminLayout>
  );
}
