import { useEffect, useMemo, useState } from "react";
import { Search, UserRound, Download, Clock3, CheckCircle2, XCircle, Users2 } from "lucide-react";
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
  postcode: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  created_at: string;
  cv_url?: string | null;
  id_proof_url?: string | null;
  rtw_doc_url?: string | null;
  dbs_cert_url?: string | null;
  [key: string]: unknown;
}

export default function AdminApplicants() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");

  const fetchApplicants = async () => {
    setFetching(true);
    setError("");
    const { data, error: err } = await supabase.from("job_applications").select("*").order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setApplications([]);
    } else {
      setApplications(((data as JobApplication[]) ?? []).slice());
    }
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) fetchApplicants();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      const matchesSearch =
        q === "" ||
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        (a.role ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  const selected = useMemo(() => applications.find((a) => a.id === selectedId) ?? null, [applications, selectedId]);

  const updateApplicant = async (id: string, patch: { status?: ApplicationStatus; admin_notes?: string | null }) => {
    setSaving(true);
    setError("");
    if (patch.status === "hired") {
      const { data, error: fnErr } = await supabase.functions.invoke("hire-applicant", {
        body: { applicationId: id },
      });
      if (fnErr || !data?.ok) {
        setError(fnErr?.message ?? data?.error ?? "Failed to hire applicant");
        setSaving(false);
        return;
      }
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
      ["Created", "Status", "Role", "First name", "Last name", "Email", "Phone", "City", "Postcode"],
      ...filtered.map((a) => [
        a.created_at,
        a.status,
        a.role,
        a.first_name,
        a.last_name,
        a.email,
        a.phone,
        a.city ?? "",
        a.postcode ?? "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? "").split('"').join('""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "makemeclean-applicants.csv";
    a.click();
    URL.revokeObjectURL(url);
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

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AdminLayout
      title="Applicants"
      subtitle="Recruitment pipeline and applicant details"
      actions={
        <button onClick={exportCSV} className="btn-primary inline-flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      }
    >

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: applications.length, icon: Users2, tone: "bg-slate-50 text-slate-700" },
          { label: "Pending", value: applications.filter((a) => a.status === "pending").length, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
          { label: "Hired", value: applications.filter((a) => a.status === "hired").length, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Rejected", value: applications.filter((a) => a.status === "rejected").length, icon: XCircle, tone: "bg-rose-50 text-rose-700" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card">
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold mb-2", tone)}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </div>
            <div className="text-2xl font-extrabold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, phone, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "pending", "reviewing", "shortlisted", "hired", "rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  statusFilter === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">{filtered.length} of {applications.length} applicants shown</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {filtered.length === 0 ? (
            <div className="card text-center py-16">
              <UserRound className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">No applicants found</p>
            </div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={cn("card w-full text-left hover:border-green-200 transition-all", selectedId === a.id && "border-green-300 ring-1 ring-green-200")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{a.first_name} {a.last_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.role}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                    a.status === "pending" ? "bg-amber-100 text-amber-700" :
                    a.status === "reviewing" ? "bg-blue-100 text-blue-700" :
                    a.status === "shortlisted" ? "bg-purple-100 text-purple-700" :
                    a.status === "hired" ? "bg-emerald-100 text-emerald-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {a.status}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-3">Submitted {new Date(a.created_at).toLocaleString("en-GB")}</p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card text-center py-16">
              <p className="text-gray-400">Select an applicant to view details</p>
            </div>
          ) : (
            <div className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">{selected.first_name} {selected.last_name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{selected.email} • {selected.phone}</p>
                  <p className="text-xs text-gray-400 mt-1">{selected.role}{selected.employment_type ? ` • ${selected.employment_type}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Status</p>
                  <select
                    className="input-field text-sm mt-1"
                    value={selected.status}
                    disabled={saving}
                    onChange={(e) => updateApplicant(selected.id, { status: e.target.value as ApplicationStatus })}
                  >
                    {(["pending", "reviewing", "shortlisted", "hired", "rejected"] as const).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-gray-100 my-5" />

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Location</p>
                  <p className="text-sm text-gray-700">{selected.city ?? "—"}{selected.postcode ? `, ${selected.postcode}` : ""}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Submitted</p>
                  <p className="text-sm text-gray-700">{new Date(selected.created_at).toLocaleString("en-GB")}</p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Admin notes</p>
                  <textarea
                    className="input-field resize-none"
                    rows={5}
                    value={selected.admin_notes ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setApplications((prev) => prev.map((a) => (a.id === selected.id ? { ...a, admin_notes: v } : a)));
                    }}
                    onBlur={() => {
                      const current = applications.find((a) => a.id === selected.id)?.admin_notes ?? "";
                      updateApplicant(selected.id, { admin_notes: current });
                    }}
                    disabled={saving}
                  />
                <p className="text-[10px] text-gray-400 mt-1">Saved when you click away.</p>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Documents</p>
                <div className="grid sm:grid-cols-2 gap-2">
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
                      className={cn(
                        "px-3 py-2 rounded-xl border text-sm font-semibold",
                        url ? "border-gray-200 text-green-700 hover:bg-green-50" : "border-gray-100 text-gray-400 pointer-events-none"
                      )}
                    >
                      {label}{url ? "" : " (not provided)"}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
