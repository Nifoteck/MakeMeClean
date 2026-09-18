import { useEffect, useState } from "react";
import {
  Search,
  Download,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  XCircle,
  UserCheck,
  X,
  Home,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import Pagination from "@/components/Pagination";
import { useScrollLock } from "@/hooks/useScrollLock";
import { Booking, StaffMember } from "@/types";
import { BOOKING_STATUS_STYLES, PAGE_SIZE } from "@/lib/constants";
import Spinner from "@/components/Spinner";

type StatusFilter = "all" | "upcoming" | "completed" | "cancelled";

const STATUS_PILL = BOOKING_STATUS_STYLES;

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});

  // Assign modal
  const [assignModal, setAssignModal] = useState<{ booking: Booking } | null>(null);
  useScrollLock(!!assignModal);
  const [pickedStaff, setPickedStaff] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [staffAvailability, setStaffAvailability] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpandedBookingIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchAll = async () => {
    setFetching(true);
    const [{ data: bData }, { data: svcData }, { data: staffData }, { data: aData }] = await Promise.all([
      supabase.from("bookings").select("*, profiles(full_name, phone)").order("created_at", { ascending: false }),
      supabase.from("services").select("id, image_url"),
      supabase.from("staff").select("id, first_name, last_name, email").eq("active", true),
      supabase.from("booking_assignments").select("booking_id, staff_id"),
    ]);
    setBookings((bData as Booking[]) ?? []);
    const imgMap: Record<string, string> = {};
    for (const s of svcData ?? []) if (s.image_url) imgMap[s.id] = s.image_url;
    setServiceImages(imgMap);
    setStaff((staffData as StaffMember[]) ?? []);
    const aMap: Record<string, string> = {};
    for (const a of aData ?? []) aMap[a.booking_id] = a.staff_id;
    setAssignments(aMap);
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const updateStatus = async (id: string, status: "completed" | "cancelled") => {
    setUpdatingId(id);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (!error) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    }
    setUpdatingId(null);
  };

  const openAssign = async (booking: Booking) => {
    setAssignModal({ booking });
    setPickedStaff(assignments[booking.id] ?? "");
    setAssignError("");

    // Check staff availability for this booking's date
    const dateObj = new Date(booking.date);
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayOfWeek = days[dateObj.getDay()];

    const { data: avData } = await supabase
      .from("staff_availability")
      .select("staff_id, is_available")
      .eq("day_of_week", dayOfWeek);

    const avMap: Record<string, boolean> = {};
    for (const a of avData ?? []) {
      avMap[a.staff_id] = a.is_available;
    }
    setStaffAvailability(avMap);
  };

  const confirmAssign = async () => {
    if (!assignModal) return;
    setAssigning(true);
    setAssignError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data, error: fnErr } = await supabase.functions.invoke("assign-staff", {
        body: { bookingId: assignModal.booking.id, staffId: pickedStaff || null },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (fnErr || !data?.ok) throw new Error(data?.error ?? fnErr?.message ?? "Failed to save assignment");
      setAssignments((prev) => {
        const next = { ...prev };
        if (pickedStaff) next[assignModal.booking.id] = pickedStaff;
        else delete next[assignModal.booking.id];
        return next;
      });
      setAssignModal(null);
    } catch (e) {
      setAssignError((e as Error).message ?? "Something went wrong.");
    } finally {
      setAssigning(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Invoice", "Service", "Customer", "Phone", "Date", "Time", "City", "Property Type", "Layout", "Extras", "Duration (hrs)", "Price", "Status", "Payment", "Assigned Staff"],
      ...filtered.map((b) => {
        const sid = assignments[b.id];
        const s = sid ? staff.find((x) => x.id === sid) : null;
        const extrasStr = Array.isArray(b.extras) ? b.extras.join(", ") : "";
        const layoutStr = `${b.bedrooms || 1} Bed, ${b.bathrooms || 1} Bath, ${b.living_rooms || 1} Living`;
        return [
          b.invoice_number ?? "",
          b.service_name,
          b.profiles?.full_name ?? "",
          b.profiles?.phone ?? "",
          b.date,
          b.time_slot,
          b.city,
          b.property_type || "House/Flat",
          layoutStr,
          extrasStr,
          b.duration_hours || 2,
          b.price,
          b.status,
          b.payment_status ?? "pending",
          s ? `${s.first_name} ${s.last_name}` : "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bookings.csv";
    a.click();
  };

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchQ =
      q === "" ||
      b.service_name.toLowerCase().includes(q) ||
      b.city.toLowerCase().includes(q) ||
      (b.invoice_number ?? "").toLowerCase().includes(q) ||
      (b.profiles?.full_name ?? "").toLowerCase().includes(q);
    return matchQ && (statusFilter === "all" || b.status === statusFilter);
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalRevenue = bookings.reduce((sum, b) => {
    if (b.payment_status !== "paid" && b.payment_status !== "refunded") return sum;
    return sum + Number(b.price) - Number(b.refunded_amount ?? 0);
  }, 0);
  const stats = [
    { label: "Total bookings", value: bookings.length },
    { label: "Upcoming", value: bookings.filter((b) => b.status === "upcoming").length },
    { label: "Completed", value: bookings.filter((b) => b.status === "completed").length },
    { label: "Total revenue", value: formatCurrency(totalRevenue) },
  ];

  if (loading || roleLoading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center text-gray-500">Please log in.</div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">No admin access.</div>;

  return (
    <AdminLayout
      title="Bookings"
      subtitle="Manage all customer bookings"
      actions={
        <button onClick={exportCSV} className="btn-primary flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      }
    >
      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !assigning && setAssignModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <p className="text-base font-bold text-gray-900">Assign staff member</p>
                <p className="text-sm text-gray-500 mt-0.5">{assignModal.booking.service_name}</p>
              </div>
              <button
                onClick={() => !assigning && setAssignModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40"
                disabled={assigning}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Booking summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  {formatDate(assignModal.booking.date)} · {assignModal.booking.time_slot}
                </div>
                <div className="flex gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  {assignModal.booking.address}, {assignModal.booking.city}, {assignModal.booking.postcode}
                </div>
                {assignModal.booking.profiles?.full_name && (
                  <div className="flex gap-2 text-gray-600">
                    <Users className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    Customer: {assignModal.booking.profiles.full_name}
                  </div>
                )}
                {/* Property & Extras in Modal */}
                <div className="flex gap-2 text-gray-700 font-medium pt-2 border-t border-gray-200/60">
                  <Home className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <span>
                    {assignModal.booking.bedrooms || 1} Bed · {assignModal.booking.bathrooms || 1} Bath ·{" "}
                    {assignModal.booking.living_rooms || 1} Living ({assignModal.booking.property_type || "House/Flat"})
                  </span>
                </div>
                {Array.isArray(assignModal.booking.extras) && assignModal.booking.extras.length > 0 && (
                  <div className="flex gap-2 text-green-800 text-xs font-semibold bg-green-50/80 p-2 rounded-lg border border-green-100">
                    <Sparkles className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                    <span>Extras: {assignModal.booking.extras.join(", ")}</span>
                  </div>
                )}
              </div>
              {/* Staff picker */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Staff member</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {/* Unassign option */}
                  <div
                    onClick={() => !assigning && setPickedStaff("")}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all",
                      pickedStaff === "" ? "border-green-500 bg-green-50" : "border-gray-100 hover:border-gray-200 bg-white"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                        pickedStaff === "" ? "border-green-500 bg-green-500" : "border-gray-300"
                      )}
                    />
                    <span className="text-sm font-semibold text-gray-500">Unassign</span>
                  </div>
                  {staff.map((s) => {
                    const available = staffAvailability[s.id];
                    const hasData = s.id in staffAvailability;
                    return (
                      <div
                        key={s.id}
                        onClick={() => !assigning && setPickedStaff(s.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all",
                          pickedStaff === s.id ? "border-green-500 bg-green-50" : "border-gray-100 hover:border-gray-200 bg-white"
                        )}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2 shrink-0 transition-colors",
                            pickedStaff === s.id ? "border-green-500 bg-green-500" : "border-gray-300"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{s.email}</p>
                        </div>
                        {hasData &&
                          (available ? (
                            <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                              Available
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full shrink-0">
                              Not set
                            </span>
                          ))}
                      </div>
                    );
                  })}
                </div>
                {pickedStaff && (
                  <p className="text-xs text-gray-400 mt-2">
                    An email notification will be sent to {staff.find((s) => s.id === pickedStaff)?.email}.
                  </p>
                )}
              </div>
              {assignError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{assignError}</p>}
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setAssignModal(null)}
                disabled={assigning}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={confirmAssign}
                disabled={assigning}
                className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
              >
                {assigning ? (
                  <>
                    <Spinner /> Saving...
                  </>
                ) : (
                  "Confirm assignment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer, invoice #, service, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "upcoming", "completed", "cancelled"] as StatusFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold capitalize transition-all",
                statusFilter === tab ? "bg-green-600 text-white shadow-xs" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      {fetching ? (
        <div className="flex items-center justify-center py-20"><Spinner /></div>
      ) : paginated.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map((b) => {
            const sid = assignments[b.id];
            const assignedStaff = sid ? staff.find((s) => s.id === sid) : null;
            const isExpanded = !!expandedBookingIds[b.id];
            const hasExtras = Array.isArray(b.extras) && b.extras.length > 0;
            const paymentLabel =
              b.payment_status === "paid"
                ? "Paid"
                : b.payment_status === "refunded"
                ? "Refunded"
                : b.payment_status === "disputed"
                ? "Disputed"
                : "Pending";
            const paymentClass =
              b.payment_status === "paid"
                ? "bg-emerald-100 text-emerald-700"
                : b.payment_status === "refunded"
                ? "bg-slate-100 text-slate-600"
                : b.payment_status === "disputed"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700";

            return (
              <div
                key={b.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:border-green-100 hover:shadow-md transition-all"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(190px,1.15fr)_minmax(170px,1fr)_minmax(230px,1.15fr)_96px_minmax(170px,0.95fr)_minmax(190px,auto)] xl:items-center">
                  {/* Customer */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-green-700">
                        {(b.profiles?.full_name ?? "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{b.profiles?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-gray-400 truncate">{b.profiles?.phone ?? ""}</p>
                      {b.invoice_number && <p className="text-xs font-mono text-gray-300">{b.invoice_number}</p>}
                    </div>
                  </div>

                  {/* Service & Layout Badges */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-green-50 border border-green-100 shrink-0">
                      {serviceImages[b.service_type] ? (
                        <img src={serviceImages[b.service_type]} alt={b.service_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">🧹</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{b.service_name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {b.city}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {b.bedrooms || 1} Bed · {b.bathrooms || 1} Bath · {b.duration_hours || 2}h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date / Time */}
                  <div className="text-sm text-gray-500 min-w-0 space-y-1">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <Calendar className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
                      <span className="leading-snug">{formatDate(b.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="truncate">{b.time_slot}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5 border-t border-gray-100 mt-1">
                      <Clock className="w-3 h-3 text-gray-200 shrink-0" />
                      <span className="text-xs text-gray-300 leading-snug">
                        Booked {new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                        at {new Date(b.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="min-w-0">
                    <p className="text-base font-black text-gray-900">{formatCurrency(b.price)}</p>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", paymentClass)}>
                      {paymentLabel}
                    </span>
                  </div>

                  {/* Assigned */}
                  <div className="min-w-0">
                    <button
                      onClick={() => openAssign(b)}
                      className={cn(
                        "flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border transition-all w-full",
                        assignedStaff
                          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                          : "border-gray-200 text-gray-400 hover:border-green-200 hover:text-green-600 hover:bg-green-50"
                      )}
                    >
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {assignedStaff ? `${assignedStaff.first_name} ${assignedStaff.last_name}` : "Assign staff"}
                      </span>
                    </button>
                  </div>

                  {/* Actions & Expand Details */}
                  <div className="flex items-center gap-2 min-w-0 md:justify-end">
                    <button
                      onClick={() => toggleExpanded(b.id)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all",
                        isExpanded
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      )}
                      title="View room layout and specialist extras"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{isExpanded ? "Hide" : "Details"}</span>
                    </button>

                    {b.status !== "upcoming" || b.payment_status === "paid" ? (
                      <span className={cn("text-xs font-bold px-3 py-1.5 rounded-full", STATUS_PILL[b.status] ?? "bg-gray-100 text-gray-500")}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700">
                        Payment pending
                      </span>
                    )}
                    {b.status !== "completed" && (
                      <button
                        disabled={updatingId === b.id}
                        onClick={() => updateStatus(b.id, "completed")}
                        className="w-8 h-8 flex items-center justify-center rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                        title="Mark complete"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    {b.status === "upcoming" && (
                      <button
                        disabled={updatingId === b.id}
                        onClick={() => updateStatus(b.id, "cancelled")}
                        className="w-8 h-8 flex items-center justify-center rounded-xl border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        title="Cancel booking"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details Panel: Full Room Layout & Specialist Extras */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 bg-gray-50/70 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-fade-in">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-gray-700 mb-1">
                        <Home className="w-3.5 h-3.5 text-green-600" />
                        <span>Property Configuration</span>
                      </div>
                      <p className="text-gray-600">
                        Type: <span className="font-semibold text-gray-800">{b.property_type || "House/Flat"}</span>
                      </p>
                      <p className="text-gray-600">
                        Layout:{" "}
                        <span className="font-semibold text-gray-800">
                          {b.bedrooms || 1} Bedrooms · {b.bathrooms || 1} Bathrooms · {b.living_rooms || 1} Living Area
                        </span>
                      </p>
                      <p className="text-gray-600">
                        Calculated Duration: <span className="font-semibold text-gray-800">{b.duration_hours || 2} Hours</span>
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-gray-700 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-green-600" />
                        <span>Specialist Add-Ons</span>
                      </div>
                      {hasExtras ? (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(b.extras as string[]).map((extra, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-100/80 text-green-800 font-medium"
                            >
                              ✓ {extra}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 italic">No specialist add-ons selected</p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-gray-700 mb-1">
                        <FileText className="w-3.5 h-3.5 text-green-600" />
                        <span>Client Instructions & Address</span>
                      </div>
                      <p className="text-gray-600">{b.address}, {b.city} {b.postcode}</p>
                      {b.notes ? (
                        <p className="mt-1 bg-white p-2 rounded border border-gray-200 text-gray-700">
                          "{b.notes}"
                        </p>
                      ) : (
                        <p className="text-gray-400 italic mt-1">No special entry notes</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4">
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </AdminLayout>
  );
}
