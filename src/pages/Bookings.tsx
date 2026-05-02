import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Calendar, Clock, MapPin, Plus, Search, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 15;

interface Booking {
  id: string;
  service_name: string;
  service_type: string;
  date: string;
  time_slot: string;
  city: string;
  status: string;
  price: number;
  invoice_number: string | null;
  created_at: string;
}

type FilterStatus = "all" | "upcoming" | "completed" | "cancelled";

const STATUS_STYLES: Record<string, string> = {
  upcoming:  "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

function Spinner() {
  return <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />;
}

export default function Bookings() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching]       = useState(true);
  const [filter, setFilter]           = useState<FilterStatus>("all");
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("bookings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("services").select("id, image_url"),
      supabase.from("reviews").select("booking_id").eq("user_id", user.id),
    ]).then(([{ data: bData }, { data: svcData }, { data: rData }]) => {
      setBookings(bData ?? []);
      const imgMap: Record<string, string> = {};
      for (const s of svcData ?? []) if (s.image_url) imgMap[s.id] = s.image_url;
      setServiceImages(imgMap);
      setReviewedIds(new Set((rData ?? []).map((r: any) => r.booking_id)));
      setFetching(false);
    });
  }, [user]);

  useEffect(() => { setPage(1); }, [filter, search]);

  const counts = {
    all:       bookings.length,
    upcoming:  bookings.filter((b) => b.status === "upcoming").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

  const filtered = bookings
    .filter((b) => filter === "all" || b.status === filter)
    .filter((b) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return b.service_name.toLowerCase().includes(q) || b.city.toLowerCase().includes(q);
    });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Bookings</h1>
            <p className="text-sm text-gray-500 mt-1">Your upcoming and past cleaning appointments</p>
          </div>
          <Link href="/book" className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto">
            <Plus className="w-4 h-4" /> New Booking
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {(["all", "upcoming", "completed", "cancelled"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "bg-white border rounded-2xl p-4 shadow-sm text-left transition-all hover:shadow-md",
                filter === f ? "border-green-400 ring-2 ring-green-100" : "border-gray-100"
              )}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                {f === "all" ? "Total" : f.charAt(0).toUpperCase() + f.slice(1)}
              </p>
              <p className="text-2xl font-black text-gray-900">{counts[f]}</p>
            </button>
          ))}
        </div>

        {/* Search + filter */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by service or city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {(["all", "upcoming", "completed", "cancelled"] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                  filter === f
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table header — desktop only */}
        {filtered.length > 0 && (
          <div className="hidden sm:grid grid-cols-12 px-5 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-5">Service</div>
            <div className="col-span-3">Date & Time</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>
        )}

        {/* Booking rows */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-semibold text-sm">
              {search ? "No bookings match your search" : `No ${filter === "all" ? "" : filter + " "}bookings`}
            </p>
            {filter === "all" && !search && (
              <Link href="/book" className="btn-primary inline-block mt-5 text-sm">Book your first clean</Link>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {paginated.map((b, i) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className={cn(
                  "grid sm:grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-gray-50 transition-colors cursor-pointer",
                  i !== 0 && "border-t border-gray-50"
                )}
              >
                {/* Service */}
                <div className="sm:col-span-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 overflow-hidden shrink-0">
                    {serviceImages[b.service_type] ? (
                      <img src={serviceImages[b.service_type]} alt={b.service_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🧹</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{b.service_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", STATUS_STYLES[b.status] ?? "bg-gray-100 text-gray-600")}>
                        {b.status}
                      </span>
                      {b.status === "completed" && (
                        reviewedIds.has(b.id) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Reviewed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                            <Star className="w-3 h-3" /> Leave a review
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="sm:col-span-3 flex sm:flex-col gap-x-4 gap-y-0.5 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {formatDate(b.date)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {b.time_slot}
                  </span>
                </div>

                {/* Location */}
                <div className="sm:col-span-2 flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{b.city}</span>
                </div>

                {/* Price */}
                <div className="sm:col-span-2 sm:text-right">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(b.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>
    </div>
  );
}
