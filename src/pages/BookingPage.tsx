import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle, ArrowLeft, Calendar, Clock, MapPin, ArrowRight, Minus, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { START_HOURS, calcTimeSlot, walesCities, Service } from "@/lib/services";
import { formatCurrency, generateInvoiceNumber } from "@/lib/utils";
import { sendTelegramBookingNotification } from "@/lib/telegram";
import { useServices } from "@/hooks/useServices";

type Step = 1 | 2 | 3;

export default function BookingPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ serviceId?: string }>();
  const { services } = useServices();

  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("09:00");
  const [durationHours, setDurationHours] = useState(2);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState("");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (params.serviceId) {
      const s = services.find((s) => s.id === params.serviceId);
      if (s) { setSelectedService(s); setStep(2); }
    }
  }, [params.serviceId, services]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("address, city, postcode")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAddress(data.address ?? "");
          setCity(data.city ?? "");
          setPostcode(data.postcode ?? "");
        }
      });
  }, [user]);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split("T")[0];

  const baseHourlyPrice = selectedService?.price ?? 0;
  const discount = Math.max(0, Math.min(100, Number(selectedService?.discount_percent ?? 0)));
  const hourlyPrice = discount > 0 ? baseHourlyPrice * (1 - discount / 100) : baseHourlyPrice;
  const totalPrice = hourlyPrice * durationHours;
  const timeSlot = calcTimeSlot(startHour, durationHours);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService) return;
    setSubmitting(true);
    setError("");

    const invoice = generateInvoiceNumber();
    const { data, error: err } = await supabase
      .from("bookings")
      .insert({
        user_id: user.id,
        service_type: selectedService.id,
        service_name: selectedService.name,
        date,
        time_slot: timeSlot,
        address,
        city,
        postcode,
        price: totalPrice,
        notes: notes || null,
        status: "upcoming",
        payment_status: "pending",
        invoice_number: invoice,
      })
      .select()
      .single();

    if (err) { setError(err.message); setSubmitting(false); return; }

    await sendTelegramBookingNotification({
      id: data.id,
      service_name: selectedService.name,
      date,
      time_slot: timeSlot,
      address,
      city,
      postcode,
      price: totalPrice,
      notes: notes || null,
      invoice_number: invoice,
      customer_email: user.email ?? undefined,
    });

    setBookingId(data.id);
    setStep(3);
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (step === 3 && selectedService) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Booking Confirmed!</h1>
        <p className="text-gray-500 mb-1">Your {selectedService.name} has been booked.</p>
        <p className="text-gray-400 text-sm mb-8">{date} · {timeSlot} · {city}</p>

        <div className="card mb-6 text-left space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Service</span>
            <span className="font-semibold">{selectedService.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date</span>
            <span className="font-semibold">{date}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Time</span>
            <span className="font-semibold">{timeSlot}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Duration</span>
            <span className="font-semibold">{durationHours} {durationHours === 1 ? "hour" : "hours"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Location</span>
            <span className="font-semibold">{city}</span>
          </div>
          <hr className="border-gray-100" />
          <div className="flex justify-between text-sm text-gray-500">
            <span>{formatCurrency(hourlyPrice)} × {durationHours} hrs</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-green-600 text-lg">{formatCurrency(totalPrice)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setLocation(`/pay/${bookingId}`)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            Pay Now — {formatCurrency(totalPrice)} <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLocation("/bookings")}
            className="btn-ghost text-sm"
          >
            Pay Later — View My Bookings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Book a Clean</h1>
          <p className="text-gray-500 mt-1">Complete your booking in a few steps.</p>
        </div>

        <div className="flex items-center mb-8">
          {[["1", "Choose Service"], ["2", "Your Details"], ["3", "Confirm"]].map(([n, label], i) => (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-2 ${parseInt(n) <= step ? "text-green-600" : "text-gray-300"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  parseInt(n) < step ? "bg-green-600 border-green-600 text-white"
                  : parseInt(n) === step ? "border-green-600 text-green-600"
                  : "border-gray-200 text-gray-300"
                }`}>
                  {parseInt(n) < step ? "✓" : n}
                </div>
                <span className="text-sm font-medium hidden sm:block">{label}</span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-0.5 mx-3 transition-colors ${step > i + 1 ? "bg-green-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Select a Service</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {services.map((s) => {
                const sDiscount = Math.max(0, Math.min(100, Number(s.discount_percent ?? 0)));
                const sPrice = sDiscount > 0 ? s.price * (1 - sDiscount / 100) : s.price;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedService(s); setStep(2); }}
                    className={`text-left card hover:border-green-400 hover:shadow-md transition-all duration-200 group ${selectedService?.id === s.id ? "border-green-500 bg-green-50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                        {s.image_url ? (
                          <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">Image</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm">{s.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{s.description}</div>
                        <div className="mt-2">
                          {sDiscount > 0 ? (
                            <span className="text-green-600 font-bold text-sm">
                              {formatCurrency(sPrice)}/hr <span className="text-gray-400 line-through font-semibold ml-1">{formatCurrency(s.price)}/hr</span>
                            </span>
                          ) : (
                            <span className="text-green-600 font-bold text-sm">{formatCurrency(s.price)}/hr</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && selectedService && (() => {
          return (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Change service
              </button>

              <div className="card border-green-200 bg-green-50 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-green-200 bg-white shrink-0">
                  {selectedService.image_url ? (
                    <img src={selectedService.image_url} alt={selectedService.name} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{selectedService.name}</p>
                  {discount > 0 ? (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold">{formatCurrency(hourlyPrice)}</span> per hour{" "}
                      <span className="text-gray-400 line-through ml-1">{formatCurrency(baseHourlyPrice)}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">{formatCurrency(hourlyPrice)} per hour</p>
                  )}
                </div>
                <span className="text-green-600 font-bold text-lg">{formatCurrency(totalPrice)}</span>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="card space-y-5">

                {/* Duration */}
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Number of Hours
                  </label>
                  <div className="flex items-center gap-4 mt-1">
                    <button
                      type="button"
                      onClick={() => setDurationHours((h) => Math.max(1, h - 1))}
                      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40"
                      disabled={durationHours <= 1}
                    >
                      <Minus className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="text-center min-w-[60px]">
                      <span className="text-2xl font-extrabold text-gray-900">{durationHours}</span>
                      <span className="text-sm text-gray-500 ml-1">{durationHours === 1 ? "hr" : "hrs"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDurationHours((h) => Math.min(12, h + 1))}
                      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40"
                      disabled={durationHours >= 12}
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-gray-400">{formatCurrency(hourlyPrice)} × {durationHours} hrs</p>
                      <p className="text-lg font-extrabold text-green-600">{formatCurrency(totalPrice)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Date
                    </label>
                    <input
                      type="date"
                      required
                      min={minDateStr}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Start Time
                    </label>
                    <select
                      required
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="input-field"
                    >
                      {START_HOURS.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {date && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Your session: <strong>{timeSlot}</strong> on <strong>{date}</strong></span>
                  </div>
                )}

                <hr className="border-gray-100" />
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Service Address
                </p>

                <div>
                  <label className="label">Postcode</label>
                  <input
                    type="text"
                    required
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    placeholder="CF10 1AB"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label">Street Address</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="12 High Street"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label">City (Wales)</label>
                  <select
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select city</option>
                    {walesCities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Special Instructions (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="E.g. key under the mat, focus on kitchen..."
                    className="input-field resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary flex-1 disabled:opacity-60"
                  >
                    {submitting ? "Booking..." : `Confirm — ${formatCurrency(totalPrice)}`}
                  </button>
                </div>
              </form>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
