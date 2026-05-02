import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Lock, CreditCard, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { sendNotification } from "@/lib/notifications";

interface Booking {
  id: string;
  service_name: string;
  date: string;
  time_slot: string;
  city: string;
  price: number;
  invoice_number: string | null;
  status: string;
  payment_status: string | null;
}

function formatCardNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(value: string) {
  return value.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");
}

export default function PaymentPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [fetching, setFetching] = useState(true);
  const [step, setStep] = useState<"form" | "processing" | "success" | "error">("form");

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user || !params.bookingId) return;
    supabase
      .from("bookings")
      .select("id, service_name, date, time_slot, city, price, invoice_number, status, payment_status")
      .eq("id", params.bookingId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setBooking(data as Booking);
        setFetching(false);
      });
  }, [user, params.bookingId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!cardName.trim()) e.cardName = "Name is required";
    if (cardNumber.replace(/\s/g, "").length < 16) e.cardNumber = "Enter a valid 16-digit card number";
    if (expiry.length < 5) e.expiry = "Enter a valid expiry (MM/YY)";
    if (cvv.length < 3) e.cvv = "Enter a valid CVV";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !booking) return;

    setStep("processing");
    // Simulate payment processing delay
    await new Promise((r) => setTimeout(r, 2000));

    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", booking.id);

    if (error) { setStep("error"); return; }

    // Booking is only confirmed after payment succeeds
    try {
      await sendNotification(supabase, { type: "booking_confirmation", bookingId: booking.id });
    } catch (e) {
      console.error("[MakeMeClean] booking confirmation email failed:", e);
    }

    // Send payment receipt email (Brevo via Supabase Edge Function)
    try {
      await sendNotification(supabase, { type: "payment_receipt", bookingId: booking.id });
    } catch (e) {
      console.error("[MakeMeClean] payment receipt email failed:", e);
    }

    setStep("success");
  };

  if (loading || fetching) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center px-4">
      <div>
        <p className="text-gray-500 font-medium mb-4">Booking not found.</p>
        <button onClick={() => setLocation("/bookings")} className="btn-primary">My Bookings</button>
      </div>
    </div>
  );

  if (booking.payment_status === "paid" || step === "success") return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Payment Successful</h1>
        <p className="text-gray-500 mb-1">Your payment has been confirmed.</p>
        {booking.invoice_number && <p className="text-sm text-gray-400 mb-8">Invoice: {booking.invoice_number}</p>}
        <div className="card mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Service</span><span className="font-semibold">{booking.service_name}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span className="font-semibold">{booking.date}</span></div>
          <hr className="border-gray-100" />
          <div className="flex justify-between"><span className="font-bold text-gray-900">Amount Paid</span><span className="font-bold text-green-600 text-lg">{formatCurrency(booking.price)}</span></div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => setLocation(`/invoice/${booking.id}`)} className="btn-secondary">Invoice</button>
          <button onClick={() => setLocation(`/bookings/${booking.id}`)} className="btn-primary">View Booking</button>
          <button onClick={() => setLocation("/dashboard")} className="btn-secondary">Dashboard</button>
        </div>
      </div>
    </div>
  );

  if (step === "error") return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Failed</h1>
        <p className="text-gray-500 mb-6">Something went wrong. Please try again.</p>
        <button onClick={() => setStep("form")} className="btn-primary">Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <button
          onClick={() => setLocation(`/bookings/${booking.id}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to booking
        </button>

        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900">Secure Payment</h1>
          <p className="text-gray-500 mt-1">Complete your payment to confirm your booking.</p>
        </div>

        {/* Booking Summary */}
        <div className="card border-green-200 bg-green-50 mb-6">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">Booking Summary</p>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-gray-900">{booking.service_name}</p>
              <p className="text-sm text-gray-500 mt-0.5">{formatDate(booking.date)} · {booking.time_slot}</p>
              <p className="text-sm text-gray-500">{booking.city}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-green-600">{formatCurrency(booking.price)}</div>
              {booking.invoice_number && <p className="text-xs text-gray-400 mt-0.5">{booking.invoice_number}</p>}
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-gray-700">Secure Card Payment</span>
            <div className="ml-auto flex gap-1.5">
              {["VISA", "MC", "AMEX"].map((card) => (
                <span key={card} className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{card}</span>
              ))}
            </div>
          </div>

          {step === "processing" ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-semibold text-gray-700">Processing payment...</p>
              <p className="text-sm text-gray-400 mt-1">Please do not close this page.</p>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="label">Cardholder Name</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="input-field"
                  data-testid="input-card-name"
                />
                {errors.cardName && <p className="text-red-500 text-xs mt-1">{errors.cardName}</p>}
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Card Number
                </label>
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="input-field font-mono tracking-widest"
                  maxLength={19}
                  data-testid="input-card-number"
                />
                {errors.cardNumber && <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Expiry Date</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    className="input-field font-mono"
                    maxLength={5}
                    data-testid="input-expiry"
                  />
                  {errors.expiry && <p className="text-red-500 text-xs mt-1">{errors.expiry}</p>}
                </div>
                <div>
                  <label className="label">CVV</label>
                  <input
                    type="text"
                    placeholder="•••"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="input-field font-mono"
                    maxLength={4}
                    data-testid="input-cvv"
                  />
                  {errors.cvv && <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3.5"
                  data-testid="button-pay"
                >
                  <Lock className="w-4 h-4" />
                  Pay {formatCurrency(booking.price)}
                </button>
              </div>

              <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5 pt-1">
                <Lock className="w-3 h-3" />
                Your payment information is encrypted and secure
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
