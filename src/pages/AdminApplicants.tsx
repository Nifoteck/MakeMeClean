import { useEffect, useMemo, useState } from "react";
import { Search, Download, Clock3, CheckCircle2, XCircle, Users2, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
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
  address: string | null;
  city: string | null;
  postcode: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  created_at: string;
  available_days: string[] | null;
  earliest_start: string | null;
  rtw_eligible: string | null;
  rtw_type: string | null;
  ni_number: string | null;
  years_experience: string | null;
  experience_types: string[] | null;
  own_equipment: string | null;
  driving_licence: string | null;
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
  const [, setLocation] = useLocation();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [activeRecruitment, setActiveRecruitment] = useState<{ id: string; title: string } | null>(null);
  const [newRecruitmentTitle, setNewRecruitmentTitle] = useState(() => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, "0");
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const y = today.getFullYear();
    const hh = String(today.getHours()).padStart(2, "0");
    const mm = String(today.getMinutes()).padStart(2, "0");
    return `Domestic Cleaner ${d}/${m}/${y} ${hh}:${mm}`;
  });
  const [recruitmentSaving, setRecruitmentSaving] = useState(false);

  const fetchActiveRecruitment = async () => {
    const { data } = await supabase
      .from("recruitments")
      .select("id,title")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveRecruitment((data as { id: string; title: string } | null) ?? null);
  };

  const fetchApplicants = async () => {
    setFetching(true);
    const { data, error: err } = await supabase.from("job_applications").select("*").order("created_at", { ascending: false });
    if (err) { setError(err.message); setApplications([]); }
    else setApplications((data as JobApplication[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (isAdmin) fetchApplicants(); }, [isAdmin]);
  useEffect(() => { if (isAdmin) fetchActiveRecruitment(); }, [isAdmin]);

  const startNewRecruitment = async () => {
    setRecruitmentSaving(true);
    setError("");
    try {
      if (activeRecruitment?.id) {
        await supabase.from("recruitments").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", activeRecruitment.id);
      }
      const title = (newRecruitmentTitle || "Recruitment").trim();
      const { error: err } = await supabase.from("recruitments").insert({ title, status: "active" });
      if (err) throw new Error(err.message);
      await fetchActiveRecruitment();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setRecruitmentSaving(false);
    }
  };

  const closeRecruitment = async () => {
    if (!activeRecruitment?.id) return;
    setRecruitmentSaving(true);
    setError("");
    try {
      const { error: err } = await supabase
        .from("recruitments")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", activeRecruitment.id);
      if (err) throw new Error(err.message);
      await fetchActiveRecruitment();
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setRecruitmentSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      const matchSearch = q === "" || `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.role ?? "").toLowerCase().includes(q);
      return matchSearch && (statusFilter === "all" || a.status === statusFilter);
    });
  }, [applications, search, statusFilter]);

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
      {/* Recruitment */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px]">
            <p className="text-xs text-gray-400 mb-1">Recruitment status</p>
            <p className="text-sm font-semibold text-gray-900">
              {activeRecruitment ? `Active: ${activeRecruitment.title}` : "Closed (not recruiting)"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <p className="text-xs text-gray-400 mb-1">New recruitment title</p>
              <input
                className="input-field text-sm h-[42px]"
                value={newRecruitmentTitle}
                onChange={(e) => setNewRecruitmentTitle(e.target.value)}
                placeholder="Recruitment"
              />
            </div>
            <button
              onClick={startNewRecruitment}
              disabled={recruitmentSaving || !!activeRecruitment}
              className="btn-primary text-sm py-2 disabled:opacity-60"
            >
              {recruitmentSaving ? "Saving..." : "Start new"}
            </button>
            <button
              onClick={closeRecruitment}
              disabled={recruitmentSaving || !activeRecruitment}
              className="btn-secondary text-sm py-2 disabled:opacity-60"
            >
              Close
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Candidates can only apply while recruitment is active. Starting a new recruitment closes the previous one so candidates can reapply under a new ID.
        </p>
      </div>

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

      {/* Applicant list */}
      <div className="card p-0 overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No applicants found</div>
        ) : filtered.map((a, i) => (
          <button
            key={a.id}
            onClick={() => setLocation(`/admin/applicants/${a.id}`)}
            className={cn(
              "w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-green-50/50 transition-colors group",
              i !== 0 && "border-t border-gray-50"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-extrabold text-green-700">{a.first_name[0]}{a.last_name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 truncate">{a.first_name} {a.last_name}</p>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0", STATUS_STYLES[a.status])}>
                  {a.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{a.role}{a.employment_type ? ` · ${a.employment_type}` : ""}</p>
              <p className="text-xs text-gray-400 mt-0.5">{a.email} · {a.phone}</p>
            </div>
            <div className="text-right shrink-0 hidden sm:block">
              <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              {a.city && <p className="text-xs text-gray-300 mt-0.5">{a.city}</p>}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors shrink-0" />
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">{filtered.length} of {applications.length} applicants</p>
    </AdminLayout>
  );
}
