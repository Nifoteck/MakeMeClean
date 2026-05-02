import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Calendar, Clock, User, ArrowRight, Plus, FileText, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Booking {
  id: string;
  service_name: string;
  service_type: string;
  date: string;
  time_slot: string;
  status: string;
  price: number;
  invoice_number: string | null;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: b }, { data: p }, { data: s }] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, service_name, service_type, date, time_slot, status, price, invoice_number")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(5),
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("services").select("id, image_url"),
      ]);
      setBookings(b ?? []);
      setProfile(p);
      const imgMap: Record<string, string> = {};
      for (const svc of s ?? []) {
        if (svc.image_url) imgMap[svc.id] = svc.image_url;
      }
      setServiceImages(imgMap);
      setFetchingData(false);
    };
    load();
  }, [user]);

  if (loading || fetchingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const upcoming = bookings.filter((b) => b.status === "upcoming");
  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">
            Hello, {displayName} 👋
          </h1>
          <p className="text-gray-500 mt-1">Here's an overview of your account.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Calendar, label: "Total Bookings", value: bookings.length, color: "bg-blue-100 text-blue-600" },
            { icon: Clock, label: "Upcoming", value: upcoming.length, color: "bg-green-100 text-green-600" },
            { icon: FileText, label: "Completed", value: completed.length, color: "bg-purple-100 text-purple-600" },
            { icon: XCircle, label: "Cancelled", value: cancelled.length, color: "bg-red-100 text-red-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="card text-center">
              <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-extrabold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Link href="/book" className="card hover:border-green-200 hover:shadow-md transition-all flex items-center gap-3 cursor-pointer" data-testid="link-dashboard-book">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">New Booking</p>
              <p className="text-xs text-gray-400">Book a cleaning service</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 ml-auto" />
          </Link>
          <Link href="/bookings" className="card hover:border-green-200 hover:shadow-md transition-all flex items-center gap-3 cursor-pointer" data-testid="link-dashboard-bookings">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">My Bookings</p>
              <p className="text-xs text-gray-400">View & manage bookings</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 ml-auto" />
          </Link>
          <Link href="/profile" className="card hover:border-green-200 hover:shadow-md transition-all flex items-center gap-3 cursor-pointer" data-testid="link-dashboard-profile">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">My Profile</p>
              <p className="text-xs text-gray-400">Edit your details</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 ml-auto" />
          </Link>
        </div>

        {/* Recent Bookings */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">Recent Bookings</h2>
            <Link href="/bookings" className="text-sm text-green-600 font-medium hover:underline">View all</Link>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-10">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No bookings yet</p>
              <Link href="/book" className="btn-primary inline-block mt-4 text-sm py-2 px-5">Book your first clean</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all"
                  data-testid={`booking-row-${b.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-50 border border-green-100 rounded-lg overflow-hidden shrink-0">
                      {serviceImages[b.service_type] ? (
                        <img src={serviceImages[b.service_type]} alt={b.service_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">🧹</div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{b.service_name}</p>
                      <p className="text-xs text-gray-400">{formatDate(b.date)} · {b.time_slot}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(b.price)}</span>
                    <span className={`badge-status-${b.status}`}>{b.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
