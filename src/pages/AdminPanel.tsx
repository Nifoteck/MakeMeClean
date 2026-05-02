import { useEffect, useState } from "react";
import { Search, Download, Calendar, Clock, MapPin, TrendingUp, Users, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";

interface Booking {
  id: string;
  service_name: string;
  date: string;
  time_slot: string;
  address: string;
  city: string;
  postcode: string;
  status: string;
  payment_status: string;
  price: number;
  notes: string | null;
  invoice_number: string | null;
  created_at: string;
  user_id: string;
  profiles: { full_name: string | null; phone: string | null } | null;
}

type StatusFilter = "all" | "upcoming" | "completed" | "cancelled";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchBookings = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("bookings")
      .select("*, profiles(full_name, phone)")
      .order("date", { ascending: false });
    setBookings((data as Booking[]) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) fetchBookings();
  }, [isAdmin]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    await supabase.from("bookings").update({ status }).eq("id", id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    setUpdatingId(null);
  };

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      q === "" ||
      b.service_name.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      (b.invoice_number ?? "").toLowerCase().includes(q) ||
      (b.profiles?.full_name ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = bookings.filter((b) => b.payment_status === "paid").reduce((s, b) => s + b.price, 0);

  const stats = [
    { label: "Total", value: bookings.length },
    { label: "Upcoming", value: bookings.filter((b) => b.status === "upcoming").length },
    { label: "Completed", value: bookings.filter((b) => b.status === "completed").length },
    { label: "Revenue", value: formatCurrency(totalRevenue) },
  ];

  const exportCSV = () => {
    const rows = [
      ["Invoice", "Service", "Customer", "Date", "Time", "City", "Price", "Status", "Payment"],
      ...filtered.map((b) => [
        b.invoice_number ?? "", b.service_name, b.profiles?.full_name ?? "",
        b.date, b.time_slot, b.city, b.price, b.status, b.payment_status ?? "pending",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bookings.csv";
    a.click();
  };

  if (loading || roleLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Please log in to access admin.</p></div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">No admin access.</p></div>;

  return (
    <AdminLayout
      title="Bookings"
      subtitle="Manage all bookings and their status"
      actions={
        <button onClick={exportCSV} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Download className="w-4 h-4" /> Export
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map(({ label, value }) => (
          <div key={label} className="card py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-xl font-extrabold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by service, customer, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "upcoming", "completed", "cancelled"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === f ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {fetching ? (
        <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No bookings found</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-3">Customer</div>
            <div className="col-span-3">Service</div>
            <div className="col-span-2">Date & Time</div>
            <div className="col-span-1">Price</div>
            <div className="col-span-3 text-right">Status</div>
          </div>

          {filtered.map((b) => (
            <div key={b.id} className="grid md:grid-cols-12 gap-2 px-5 py-4 border-t border-gray-100 items-center hover:bg-gray-50 transition-colors">
              <div className="md:col-span-3">
                <p className="text-sm font-semibold text-gray-900">{b.profiles?.full_name ?? "Unknown"}</p>
                <p className="text-xs text-gray-400">{b.profiles?.phone ?? ""}</p>
                {b.invoice_number && <p className="text-xs text-gray-400 font-mono">{b.invoice_number}</p>}
              </div>
              <div className="md:col-span-3">
                <p className="text-sm text-gray-800">{b.service_name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{b.city}</p>
              </div>
              <div className="md:col-span-2 text-xs text-gray-500 space-y-0.5">
                <p className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(b.date)}</p>
                <p className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.time_slot}</p>
              </div>
              <div className="md:col-span-1">
                <p className="text-sm font-bold text-gray-900">{formatCurrency(b.price)}</p>
                <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", b.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                  {b.payment_status ?? "pending"}
                </span>
              </div>
              <div className="md:col-span-3 flex items-center justify-end gap-2 flex-wrap">
                <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600")}>
                  {b.status}
                </span>
                {b.status !== "completed" && (
                  <button
                    disabled={updatingId === b.id}
                    onClick={() => updateStatus(b.id, "completed")}
                    className="text-xs text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-40"
                  >
                    <CheckCircle className="w-3.5 h-3.5 inline mr-1" />Done
                  </button>
                )}
                {b.status === "upcoming" && (
                  <button
                    disabled={updatingId === b.id}
                    onClick={() => updateStatus(b.id, "cancelled")}
                    className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <XCircle className="w-3.5 h-3.5 inline mr-1" />Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-3">{filtered.length} of {bookings.length} bookings</p>
    </AdminLayout>
  );
}
