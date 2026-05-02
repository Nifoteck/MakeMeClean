import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Calendar, Clock, MapPin, Plus, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatDate, formatCurrency } from "@/lib/utils";

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
}

type FilterStatus = "all" | "upcoming" | "completed" | "cancelled";

export default function Bookings() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("bookings").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("services").select("id, image_url"),
    ]).then(([{ data: bookingsData }, { data: servicesData }]) => {
      setBookings(bookingsData ?? []);
      const imgMap: Record<string, string> = {};
      for (const s of servicesData ?? []) {
        if (s.image_url) imgMap[s.id] = s.image_url;
      }
      setServiceImages(imgMap);
      setFetching(false);
    });
  }, [user]);

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);
  const counts = {
    all: bookings.length,
    upcoming: bookings.filter((b) => b.status === "upcoming").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };


  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">My Bookings</h1>
            <p className="text-gray-500 mt-1">Your upcoming and past cleaning appointments.</p>
          </div>
          <Link href="/book" className="btn-primary flex items-center gap-2 text-sm" data-testid="link-new-booking">
            <Plus className="w-4 h-4" /> New Booking
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          {(["all", "upcoming", "completed", "cancelled"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${filter === f ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-green-300"}`}
              data-testid={`filter-${f}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card text-center py-16">
            <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No {filter === "all" ? "" : filter} bookings</p>
            {filter === "all" && (
              <Link href="/book" className="btn-primary inline-block mt-5 text-sm">Book your first clean</Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="card hover:border-green-200 hover:shadow-md transition-all flex items-center gap-4 cursor-pointer"
                data-testid={`booking-card-${b.id}`}
              >
                <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-xl overflow-hidden shrink-0">
                  {serviceImages[b.service_type] ? (
                    <img src={serviceImages[b.service_type]} alt={b.service_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🧹</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{b.service_name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" /> {formatDate(b.date)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" /> {b.time_slot}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" /> {b.city}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900">{formatCurrency(b.price)}</p>
                  <span className={`badge-status-${b.status} mt-1`}>{b.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
