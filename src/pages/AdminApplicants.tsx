import { useEffect, useMemo, useState } from "react";
import { Search, Download, Users2, Clock3, CheckCircle2, XCircle, ChevronRight, Radio } from "lucide-react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import Pagination from "@/components/Pagination";
import { ApplicationStatus, JobApplication } from "@/types";
import { APPLICATION_STATUS_STYLES, PAGE_SIZE } from "@/lib/constants";
import Spinner from "@/components/Spinner";

const STATUS_STYLES = APPLICATION_STATUS_STYLES;

export default function AdminApplicants() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const [, setLocation] = useLocation();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [fetching, setFetching]         = useState(false);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [page, setPage]                 = useState(1);

  const [activeRecruitment, setActiveRecruitment] = useState<{ id: string; title: string } | null>(null);
  const [recruitmentTitle, setRecruitmentTitle]   = useState(() => {
    const t = new Date();
    return `Domestic Cleaner ${String(t.getDate()).padStart(2,"0")}/${String(t.getMonth()+1).padStart(2,"0")}/${t.getFullYear()}`;
  });
  const [recruitmentSaving, setRecruitmentSaving] = useState(false);
  const [showRecruit, setShowRecruit]             = useState(false);

  const fetchRecruitment = async () => {
    const { data } = await supabase.from("recruitments").select("id,title").eq("status","active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setActiveRecruitment((data as { id: string; title: string } | null) ?? null);
  };

  const fetchApplicants = async () => {
    setFetching(true);
    const { data, error: err } = await supabase.from("job_applications").select("*").order("created_at", { ascending: false });
    if (err) { setError(err.message); setApplications([]); }
    else setApplications((data as JobApplication[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { if (isAdmin) { fetchApplicants(); fetchRecruitment(); } }, [isAdmin]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const startRecruitment = async () => {
    setRecruitmentSaving(true); setError("");
    try {
      if (activeRecruitment?.id) {
        await supabase.from("recruitments").update({ status:"closed", closed_at: new Date().toISOString() }).eq("id", activeRecruitment.id);
      }
      const { error: err } = await supabase.from("recruitments").insert({ title: recruitmentTitle.trim() || "Recruitment", status:"active" });
      if (err) throw new Error(err.message);
      await fetchRecruitment();
      setShowRecruit(false);
    } catch (e) { setError(String((e as Error)?.message ?? e)); }
    finally { setRecruitmentSaving(false); }
  };

  const closeRecruitment = async () => {
    if (!activeRecruitment?.id) return;
    setRecruitmentSaving(true); setError("");
    try {
      await supabase.from("recruitments").update({ status:"closed", closed_at: new Date().toISOString() }).eq("id", activeRecruitment.id);
      await fetchRecruitment();
    } catch (e) { setError(String((e as Error)?.message ?? e)); }
    finally { setRecruitmentSaving(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      const matchQ = q === "" || `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.role ?? "").toLowerCase().includes(q);
      return matchQ && (statusFilter === "all" || a.status === statusFilter);
    });
  }, [applications, search, statusFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCSV = () => {
    const rows = [
      ["Date", "Status", "Role", "Name", "Email", "Phone", "City"],
      ...filtered.map((a) => [a.created_at, a.status, a.role, `${a.first_name} ${a.last_name}`, a.email, a.phone, a.city ?? ""]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob); el.download = "applicants.csv"; el.click();
  };

  const counts = {
    total:     applications.length,
    pending:   applications.filter((a) => a.status === "pending").length,
    hired:     applications.filter((a) => a.status === "hired").length,
    rejected:  applications.filter((a) => a.status === "rejected").length,
  };

  if (loading || roleLoading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  if (!user)    return <div className="min-h-screen flex items-center justify-center text-gray-500">Please log in.</div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">No admin access.</div>;

  return (
    <AdminLayout title="Applicants" subtitle="Recruitment pipeline and applications" actions={
      <button onClick={exportCSV} className="btn-primary flex items-center gap-2 text-sm">
        <Download className="w-4 h-4" /> Export CSV
      </button>
    }>

      {/* Recruitment status */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", activeRecruitment ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
            <div>
              <p className="text-sm font-bold text-gray-900">
                {activeRecruitment ? activeRecruitment.title : "Recruitment closed"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeRecruitment ? "Applications are open — candidates can apply now." : "No active recruitment. Start one to accept applications."}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {!showRecruit && (
              <button onClick={() => setShowRecruit(true)} disabled={!!activeRecruitment || recruitmentSaving}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors">
                Start recruitment
              </button>
            )}
            {activeRecruitment && (
              <button onClick={closeRecruitment} disabled={recruitmentSaving}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                {recruitmentSaving ? "Closing..." : "Close recruitment"}
              </button>
            )}
          </div>
        </div>
        {showRecruit && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-500 mb-2">Recruitment title</label>
            <div className="flex gap-3">
              <input value={recruitmentTitle} onChange={(e) => setRecruitmentTitle(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
              <button onClick={startRecruitment} disabled={recruitmentSaving}
                className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                {recruitmentSaving ? "Starting..." : "Confirm"}
              </button>
              <button onClick={() => setShowRecruit(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Starting a new recruitment will close the current one.</p>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",    value: counts.total,    icon: Users2       },
          { label: "Pending",  value: counts.pending,  icon: Clock3       },
          { label: "Hired",    value: counts.hired,    icon: CheckCircle2 },
          { label: "Rejected", value: counts.rejected, icon: XCircle      },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
            <p className="text-2xl font-black text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search name, email, role..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all","pending","reviewing","shortlisted","hired","rejected"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                statusFilter === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {fetching ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <Users2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No applicants found</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {paginated.map((a, i) => (
            <button key={a.id} onClick={() => setLocation(`/admin/applicants/${a.id}`)}
              className={cn("w-full text-left flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group",
                i !== 0 && "border-t border-gray-50")}>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-green-700">{a.first_name[0]}{a.last_name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900">{a.first_name} {a.last_name}</p>
                  <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide", STATUS_STYLES[a.status])}>
                    {a.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{a.role}{a.employment_type ? ` · ${a.employment_type}` : ""}</p>
                <p className="text-xs text-gray-400">{a.email} · {a.phone}</p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                </p>
                {a.city && <p className="text-xs text-gray-300 mt-0.5">{a.city}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4">
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </AdminLayout>
  );
}
