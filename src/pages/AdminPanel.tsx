import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";

interface Booking {
  id: string;
  service_name: string;
  service_type: string;
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
type PayFilter = "all" | "paid" | "pending";

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) return;
  }, [loading, user]);

  const fetchBookings = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("*, profiles(full_name, phone)")
      .order("created_at", { ascending: false });
    if (error) {
      setBookings([]);
    } else {
      setBookings((data as Booking[]) ?? []);
    }
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
    const matchSearch =
      search === "" ||
      b.service_name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.profiles?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    const matchPay = payFilter === "all" || (b.payment_status ?? "pending") === payFilter;
    return matchSearch && matchStatus && matchPay;
  });

  const totalRevenue = bookings
    .filter((b) => (b.payment_status ?? "pending") === "paid")
    .reduce((s, b) => s + b.price, 0);

  const stats = [
    { label: "Total Bookings", value: bookings.length, color: "bg-blue-50 text-blue-600" },
    { label: "Upcoming", value: bookings.filter((b) => b.status === "upcoming").length, color: "bg-green-50 text-green-600" },
    { label: "Completed", value: bookings.filter((b) => b.status === "completed").length, color: "bg-purple-50 text-purple-600" },
    { label: "Revenue (Paid)", value: formatCurrency(totalRevenue), color: "bg-emerald-50 text-emerald-600" },
  ];

  const exportCSV = () => {
    const rows = [
      ["Invoice", "Service", "Customer", "Date", "Time", "City", "Price", "Status", "Payment"],
      ...filtered.map((b) => [
        b.invoice_number ?? "",
        b.service_name,
        b.profiles?.full_name ?? "Unknown",
        b.date,
        b.time_slot,
        b.city,
        b.price,
        b.status,
        b.payment_status ?? "pending",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "makemeclean-bookings.csv";
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
      title="Bookings"
      subtitle="Manage bookings, status, and payments"
      actions={
        <button onClick={exportCSV} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      }
    >

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="card">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${color} mb-2`}>
              <TrendingUp className="w-3 h-3" /> {label}
            </div>
            <div className="text-2xl font-extrabold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by service, customer, city, invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
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
            <div className="w-px h-5 bg-gray-200" />
            {(["all", "paid", "pending"] as PayFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setPayFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  payFilter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {f === "all" ? "All payments" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">{filtered.length} of {bookings.length} bookings shown</p>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="card hover:border-green-200 transition-all">
              <div className="flex flex-wrap items-center gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}>
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-400">{b.invoice_number ?? "No invoice"}</span>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        b.status === "upcoming"
                          ? "bg-blue-100 text-blue-700"
                          : b.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                      )}
                    >
                      {b.status}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        (b.payment_status ?? "pending") === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {b.payment_status ?? "pending"}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 mt-0.5">{b.service_name}</p>
                  <p className="text-xs text-gray-500">
                    {b.profiles?.full_name ?? "Unknown customer"}
                    {b.profiles?.phone ? ` · ${b.profiles.phone}` : ""}
                  </p>
                </div>

                <div className="hidden sm:block text-sm text-gray-500 space-y-0.5">
                  <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDate(b.date)}</div>
                  <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {b.time_slot}</div>
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {b.city}, {b.postcode}</div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-extrabold text-gray-900">{formatCurrency(b.price)}</div>
                  <ChevronDown className={cn("w-4 h-4 text-gray-400 ml-auto mt-1 transition-transform", expandedId === b.id && "rotate-180")} />
                </div>
              </div>

              {expandedId === b.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Full Address</p>
                      <p className="text-sm text-gray-700">{b.address}, {b.city}, {b.postcode}</p>
                    </div>
                    {b.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-gray-700">{b.notes}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Booked</p>
                      <p className="text-sm text-gray-700">{new Date(b.created_at).toLocaleString("en-GB")}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Booking ID</p>
                      <p className="text-xs font-mono text-gray-500 break-all">{b.id}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <p className="text-xs font-semibold text-gray-500 self-center mr-1">Update status:</p>
                    {(["upcoming", "completed", "cancelled"] as const).map((s) => (
                      <button
                        key={s}
                        disabled={b.status === s || updatingId === b.id}
                        onClick={() => updateStatus(b.id, s)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                          b.status === s
                            ? "bg-gray-100 text-gray-500 border-gray-200"
                            : s === "completed"
                              ? "border-green-200 text-green-700 hover:bg-green-50"
                              : s === "cancelled"
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-blue-200 text-blue-600 hover:bg-blue-50"
                        )}
                      >
                        {s === "completed" ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : s === "cancelled" ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5" />
                        )}
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
