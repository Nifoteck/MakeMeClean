import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Calendar, Clock, MapPin, LogOut, BriefcaseBusiness } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStaffRecord } from "@/hooks/useRole";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

interface AssignedBooking {
  id: string;
  service_name: string;
  date: string;
  time_slot: string;
  address: string;
  city: string;
  postcode: string;
  price: number;
  status: string;
  payment_status: string | null;
}

export default function StaffDashboard() {
  const { user, loading, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { staff, loading: staffLoading } = useStaffRecord(user?.id);

  const [fetching, setFetching] = useState(false);
  const [bookings, setBookings] = useState<AssignedBooking[]>([]);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  const fetchAssigned = async (staffId: string) => {
    setFetching(true);
    const { data } = await supabase
      .from("booking_assignments")
      .select("status, bookings(id, service_name, date, time_slot, address, city, postcode, price, status, payment_status)")
      .eq("staff_id", staffId)
      .order("assigned_at", { ascending: false });

    const rows = (data as any[] | null) ?? [];
    setBookings(rows.map((r) => r.bookings).filter(Boolean));
    setFetching(false);
  };

  useEffect(() => {
    if (staff?.id) fetchAssigned(staff.id);
  }, [staff?.id]);

  const upcoming = useMemo(() => bookings.filter((b) => b.status === "upcoming"), [bookings]);

  if (loading || staffLoading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full card text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Staff portal</h1>
          <p className="text-sm text-gray-500">Your account isn’t linked to a staff profile yet.</p>
          <p className="text-xs text-gray-400 mt-2">Ask an admin to assign your account.</p>
          <button onClick={signOut} className="btn-secondary mt-6 inline-flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <BriefcaseBusiness className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Staff Portal</h1>
              <p className="text-xs text-gray-400">{staff.first_name} {staff.last_name}</p>
            </div>
          </div>
          <button onClick={signOut} className="btn-secondary inline-flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Assigned", value: bookings.length, tone: "bg-slate-50 text-slate-700" },
            { label: "Upcoming", value: upcoming.length, tone: "bg-emerald-50 text-emerald-700" },
          ].map(({ label, value, tone }) => (
            <div key={label} className="card">
              <div className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold mb-2", tone)}>{label}</div>
              <div className="text-2xl font-extrabold text-gray-900">{value}</div>
            </div>
          ))}
        </div>

        {upcoming.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">No upcoming bookings assigned.</div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <div key={b.id} className="card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{b.service_name}</p>
                    <div className="text-sm text-gray-500 mt-1 space-y-1">
                      <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-green-600" /> {formatDate(b.date)}</div>
                      <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-green-600" /> {b.time_slot}</div>
                      <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-green-600" /> {b.address}, {b.city}, {b.postcode}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-gray-900">{formatCurrency(b.price)}</div>
                    <div className="text-xs text-gray-400 mt-1">{(b.payment_status ?? "pending") === "paid" ? "Paid" : "Unpaid"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

