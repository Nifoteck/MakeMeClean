import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Calendar, Clock, MapPin, FileText, Download, AlertTriangle, CreditCard, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatDate, formatCurrency } from "@/lib/utils";
import { services } from "@/lib/services";

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
  payment_status: string | null;
  price: number;
  notes: string | null;
  invoice_number: string | null;
  created_at: string;
}

export default function BookingDetail() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [fetching, setFetching] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user || !params.id) return;
    supabase
      .from("bookings")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setBooking(data as Booking);
        setFetching(false);
      });
  }, [user, params.id]);

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    setBooking({ ...booking, status: "cancelled" });
    setCancelling(false);
    setShowConfirm(false);
  };

  const ServiceIcon = booking
    ? services.find((s) => s.id === booking.service_type)?.icon
    : null;

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
        <div>
          <p className="text-gray-500 text-lg font-medium mb-4">Booking not found.</p>
          <Link href="/bookings" className="btn-primary">Back to Bookings</Link>
        </div>
      </div>
    );
  }

  const isPaid = booking.payment_status === "paid";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/bookings" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to bookings
        </Link>

        {/* Main card */}
        <div className="card mb-5">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center shrink-0">
              {ServiceIcon
                ? <ServiceIcon className="w-7 h-7 text-green-600" />
                : <FileText className="w-7 h-7 text-green-600" />
              }
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold text-gray-900">{booking.service_name}</h1>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className={`badge-status-${booking.status}`}>{booking.status}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {isPaid ? "Paid" : "Payment pending"}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-extrabold text-green-600">{formatCurrency(booking.price)}</div>
            </div>
          </div>

          <hr className="border-gray-100 mb-5" />

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Date</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(booking.date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Time Slot</p>
                <p className="text-sm font-semibold text-gray-900">{booking.time_slot}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Address</p>
                <p className="text-sm font-semibold text-gray-900">
                  {booking.address}<br />{booking.city}, {booking.postcode}
                </p>
              </div>
            </div>
            {booking.notes && (
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Special Instructions</p>
                  <p className="text-sm text-gray-600">{booking.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pay Now banner */}
        {!isPaid && booking.status === "upcoming" && (
          <div className="card border-amber-200 bg-amber-50 mb-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">Payment pending</p>
                <p className="text-xs text-amber-700">Complete your payment to confirm your booking.</p>
              </div>
            </div>
            <Link
              href={`/pay/${booking.id}`}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shrink-0"
              data-testid="link-pay-now"
            >
              Pay {formatCurrency(booking.price)}
            </Link>
          </div>
        )}

        {/* Paid banner */}
        {isPaid && (
          <div className="card border-emerald-200 bg-emerald-50 mb-5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">Payment confirmed — {formatCurrency(booking.price)}</p>
          </div>
        )}

        {/* Invoice */}
        {booking.invoice_number && (
          <div className="card mb-5 border-dashed border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Invoice</p>
                  <p className="text-xs text-gray-400">{booking.invoice_number}</p>
                </div>
              </div>
              <button
                className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline"
                data-testid="button-download-invoice"
                onClick={() => {
                  const content = `INVOICE\n\nMakeMeClean — Professional Cleaning Services\nWales, UK | aadeeniiyii@gmail.com | +44 7362 068202\n\nInvoice Number: ${booking.invoice_number}\nDate Issued: ${new Date(booking.created_at).toLocaleDateString("en-GB")}\nPayment Status: ${booking.payment_status === "paid" ? "PAID" : "PENDING"}\n\n${"─".repeat(50)}\n\nSERVICE DETAILS\n\nService:  ${booking.service_name}\nDate:     ${booking.date}\nTime:     ${booking.time_slot}\nAddress:  ${booking.address}, ${booking.city}, ${booking.postcode}\n\n${"─".repeat(50)}\n\nAMOUNT DUE: ${formatCurrency(booking.price)}\n\n${"─".repeat(50)}\n\nThank you for choosing MakeMeClean!\nWe look forward to seeing you again.`;
                  const blob = new Blob([content], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${booking.invoice_number}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
            <hr className="border-gray-100 my-4" />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Service</span>
                <span className="font-medium">{booking.service_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{booking.date}</span>
              </div>
              <hr className="border-gray-100" />
              <div className="flex justify-between">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-green-600 text-lg">{formatCurrency(booking.price)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cancel */}
        {booking.status === "upcoming" && (
          <div>
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full border border-red-200 text-red-600 font-medium py-3 rounded-xl hover:bg-red-50 transition-colors text-sm"
                data-testid="button-cancel-booking"
              >
                Cancel Booking
              </button>
            ) : (
              <div className="card border-red-200 bg-red-50">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-800 text-sm">Cancel this booking?</p>
                    <p className="text-xs text-red-600 mt-0.5">This action cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors"
                  >
                    Keep Booking
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
                    data-testid="button-confirm-cancel"
                  >
                    {cancelling ? "Cancelling..." : "Yes, Cancel"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
