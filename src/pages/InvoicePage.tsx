import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Booking {
  id: string;
  service_name: string;
  date: string;
  time_slot: string;
  address: string;
  city: string;
  postcode: string;
  price: number;
  invoice_number: string | null;
  payment_status: string | null;
  created_at?: string;
}

export default function InvoicePage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user || !params.bookingId) return;
    supabase
      .from("bookings")
      .select("id, service_name, date, time_slot, address, city, postcode, price, invoice_number, payment_status, created_at")
      .eq("id", params.bookingId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setBooking(data as Booking);
        setFetching(false);
      });
  }, [user, params.bookingId]);

  const issuedOn = useMemo(() => {
    if (!booking?.created_at) return new Date().toISOString().slice(0, 10);
    return booking.created_at.slice(0, 10);
  }, [booking?.created_at]);

  useEffect(() => {
    if (!booking) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      setTimeout(() => window.print(), 300);
    }
  }, [booking]);

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
          <p className="text-gray-500 font-medium mb-4">Invoice not found.</p>
          <button onClick={() => setLocation("/bookings")} className="btn-primary">My Bookings</button>
        </div>
      </div>
    );
  }

  const downloadPdf = () => {
    // Browser-native "Save as PDF" via print dialog (most reliable without extra libraries)
    const url = `${window.location.origin}/invoice/${booking.id}?print=1`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6 print:hidden">
          <button onClick={() => setLocation(`/bookings/${booking.id}`)} className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={() => window.print()} className="btn-secondary inline-flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={downloadPdf} className="btn-primary inline-flex items-center gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-8 py-8 border-b border-gray-100">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Invoice</p>
                <h1 className="text-3xl font-black text-gray-900 mt-2">MakeMeClean</h1>
                <p className="text-sm text-gray-500 mt-1">payment@makemeclean.co.uk</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Invoice number</p>
                <p className="text-lg font-extrabold text-gray-900">{booking.invoice_number ?? booking.id}</p>
                <p className="text-sm text-gray-500 mt-2">Issued on</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(issuedOn)}</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            <div className="grid sm:grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Billed To</p>
                <p className="font-bold text-gray-900">{user?.email}</p>
                <p className="text-sm text-gray-500 mt-2">{booking.address}</p>
                <p className="text-sm text-gray-500">{booking.city}</p>
                <p className="text-sm text-gray-500">{booking.postcode}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Service Details</p>
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex justify-between gap-4">
                    <span>Service</span>
                    <span className="font-semibold text-gray-900">{booking.service_name}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Date</span>
                    <span className="font-semibold text-gray-900">{formatDate(booking.date)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Time</span>
                    <span className="font-semibold text-gray-900">{booking.time_slot}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Status</span>
                    <span className="font-semibold text-gray-900">
                      {booking.payment_status === "paid" ? "Paid" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-500 px-5 py-3">
                <div className="col-span-7">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-3 text-right">Amount</div>
              </div>
              <div className="grid grid-cols-12 px-5 py-4 text-sm">
                <div className="col-span-7">
                  <p className="font-semibold text-gray-900">{booking.service_name}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(booking.date)} · {booking.time_slot}</p>
                </div>
                <div className="col-span-2 text-right text-gray-700">1</div>
                <div className="col-span-3 text-right font-semibold text-gray-900">{formatCurrency(booking.price)}</div>
              </div>
              <div className="border-t border-gray-100 px-5 py-4">
                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(booking.price)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>VAT</span>
                      <span>£0.00</span>
                    </div>
                    <div className="h-px bg-gray-100 my-2" />
                    <div className="flex justify-between text-gray-900 font-extrabold text-base">
                      <span>Total</span>
                      <span>{formatCurrency(booking.price)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-gray-50 p-5 text-xs text-gray-500">
              <p className="font-semibold text-gray-700 mb-1">Notes</p>
              <p>Thank you for choosing MakeMeClean. For questions about this invoice, contact payment@makemeclean.co.uk.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
