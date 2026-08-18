import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle, ArrowLeft, Calendar, Clock, MapPin, ArrowRight, Minus, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { START_HOURS, calcTimeSlot, walesCities, Service } from "@/lib/services";
import { cn, formatCurrency, generateInvoiceNumber } from "@/lib/utils";
import { sendTelegramBookingNotification } from "@/lib/telegram";
import { useServices } from "@/hooks/useServices";

type Step = 1 | 2 | 3;
type RecurringFreq = "none" | "weekly" | "fortnightly" | "monthly";

// Discount defaults loaded from database, not hardcoded
const EMPTY_DISCOUNTS: Record<RecurringFreq, number> = {
  none: 0, weekly: 0, fortnightly: 0, monthly: 0,
};

const FREQ_LABELS: Record<string, string> = {
  weekly: "Every week", fortnightly: "Every 2 weeks", monthly: "Every month",
};

const MIN_DURATION_HOURS = 1.5;
const MAX_DURATION_HOURS = 12;
const DURATION_STEP_HOURS = 0.5;

function formatDuration(hours: number) {
  if (hours === 0.5) return "30 minutes";
  if (hours % 1 === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const wholeHours = Math.floor(hours);
  return `${wholeHours} ${wholeHours === 1 ? "hour" : "hours"} 30 minutes`;
}

export default function BookingPage() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ serviceId?: string }>();
  const { services } = useServices();

  const [step, setStep]                     = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [date, setDate]                     = useState("");
  const [startHour, setStartHour]           = useState("09:00");
  const [durationHours, setDurationHours]   = useState(2);
  const [address, setAddress]               = useState("");
  const [city, setCity]                     = useState("");
  const [postcode, setPostcode]             = useState("");
  const [notes, setNotes]                   = useState("");
  const [recurringFreq, setRecurringFreq]   = useState<RecurringFreq>("none");
  const [liveDiscounts, setLiveDiscounts]   = useState<Record<RecurringFreq, number>>(EMPTY_DISCOUNTS);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState("");
  const [bookingId, setBookingId]           = useState("");

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["discount_weekly", "discount_fortnightly", "discount_monthly"])
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const map: Record<string, number> = {};
        for (const row of data) map[row.key] = Number(row.value) || 0;
        setLiveDiscounts({
          none:        0,
          weekly:      Number(map["discount_weekly"])      || 0,
          fortnightly: Number(map["discount_fortnightly"]) || 0,
          monthly:     Number(map["discount_monthly"])     || 0,
        });
      });
  }, []);

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
  const minDateStr = minDate.toISOString().split("T")[0];

  const baseHourlyPrice = selectedService?.price ?? 0;
  const svcDiscount     = Math.max(0, Math.min(100, Number(selectedService?.discount_percent ?? 0)));
  const hourlyPrice     = svcDiscount > 0 ? baseHourlyPrice * (1 - svcDiscount / 100) : baseHourlyPrice;
  const totalPrice      = hourlyPrice * durationHours;
  const recurringPct    = liveDiscounts[recurringFreq] ?? 0;
  const finalPrice      = recurringPct > 0 ? totalPrice * (1 - recurringPct / 100) : totalPrice;
  const timeSlot        = calcTimeSlot(startHour, durationHours);
  const availableStartHours = date === minDateStr
    ? START_HOURS.filter((h) => new Date(`${date}T${h}:00`).getTime() > Date.now())
    : START_HOURS;

  useEffect(() => {
    if (date && availableStartHours.length > 0 && !availableStartHours.includes(startHour)) {
      setStartHour(availableStartHours[0]);
    }
  }, [date, availableStartHours, startHour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService) return;
    if (availableStartHours.length === 0) {
      setError("No future start times are available today. Please choose another date.");
      return;
    }
    if (durationHours < MIN_DURATION_HOURS) {
      setError(`Minimum booking duration is ${formatDuration(MIN_DURATION_HOURS)}.`);
      return;
    }
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
        price: finalPrice,
        notes: notes || null,
        status: "upcoming",
        payment_status: "pending",
        invoice_number: invoice,
      })
      .select()
      .single();

    if (err) { setError(err.message); setSubmitting(false); return; }

    // Create recurring plan if selected
    if (recurringFreq !== "none") {
      await supabase.from("recurring_plans").insert({
        user_id: user.id,
        service_type: selectedService.id,
        service_name: selectedService.name,
        frequency: recurringFreq,
        start_time: startHour,
        duration_hours: durationHours,
        address,
        city,
        postcode,
        price_per_visit: finalPrice,
        discount_percent: recurringPct,
        notes: notes || null,
        status: "active",
      });
    }

    await sendTelegramBookingNotification({
      id: data.id,
      service_name: selectedService.name,
      date,
      time_slot: timeSlot,
      address,
      city,
      postcode,
      price: finalPrice,
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
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Booking Created</h1>
        <p className="text-gray-500 mb-1">Your {selectedService.name} is ready for payment.</p>
        <p className="text-gray-400 text-sm mb-8">{date} · {timeSlot} · {address}, {city}, {postcode}</p>

        <div className="card mb-4 text-left space-y-2.5">
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
            <span className="font-semibold">{formatDuration(durationHours)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Location</span>
            <span className="font-semibold text-right">{address}, {city}, {postcode}</span>
          </div>
          {recurringFreq !== "none" && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Schedule</span>
              <span className="font-semibold text-green-600">{FREQ_LABELS[recurringFreq]}</span>
            </div>
          )}
          <hr className="border-gray-100" />
          <div className="flex justify-between text-sm text-gray-500">
            <span>{formatCurrency(hourlyPrice)} × {formatDuration(durationHours)}{recurringPct > 0 ? ` − ${recurringPct}% recurring` : ""}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-bold text-green-600 text-lg">{formatCurrency(finalPrice)}</span>
          </div>
        </div>

        {recurringFreq !== "none" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 text-left">
            <div className="flex items-center gap-2 text-green-700 font-bold text-sm mb-1">
              <RefreshCw className="w-4 h-4" /> Recurring plan created
            </div>
            <p className="text-xs text-green-600">
              You're saving {recurringPct}% on every visit. Manage your plan from <strong>My Plans</strong>.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setLocation(`/pay/${bookingId}`)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            Pay Now — {formatCurrency(finalPrice)} <ArrowRight className="w-4 h-4" />
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

        {/* Progress */}
        <div className="flex items-center mb-8">
          {[["1", "Choose Service"], ["2", "Your Details"], ["3", "Confirm"]].map(([n, label], i) => (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-2 ${parseInt(n) <= step ? "text-green-600" : "text-gray-300"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                  parseInt(n) < step  ? "bg-green-600 border-green-600 text-white"
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

        {/* Step 1 — Choose service */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Select a Service</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {services.map((s) => {
                const sd = Math.max(0, Math.min(100, Number(s.discount_percent ?? 0)));
                const sp = sd > 0 ? s.price * (1 - sd / 100) : s.price;
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
                          {sd > 0 ? (
                            <span className="text-green-600 font-bold text-sm">
                              {formatCurrency(sp)}/hr <span className="text-gray-400 line-through font-semibold ml-1">{formatCurrency(s.price)}/hr</span>
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

        {/* Step 2 — Details form */}
        {step === 2 && selectedService && (() => {
          return (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-600 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Change service
              </button>

              {/* Selected service summary */}
              <div className="card border-green-200 bg-green-50 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-green-200 bg-white shrink-0">
                  {selectedService.image_url && (
                    <img src={selectedService.image_url} alt={selectedService.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{selectedService.name}</p>
                  {svcDiscount > 0 ? (
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold">{formatCurrency(hourlyPrice)}</span>/hr{" "}
                      <span className="text-gray-400 line-through ml-1">{formatCurrency(baseHourlyPrice)}/hr</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">{formatCurrency(hourlyPrice)}/hr</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-green-600 font-bold text-lg">{formatCurrency(finalPrice)}</span>
                  {recurringPct > 0 && (
                    <p className="text-xs text-orange-500 font-semibold">{recurringPct}% off</p>
                  )}
                </div>
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
                    <button type="button" onClick={() => setDurationHours((h) => Math.max(MIN_DURATION_HOURS, h - DURATION_STEP_HOURS))}
                      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40"
                      disabled={durationHours <= MIN_DURATION_HOURS}>
                      <Minus className="w-4 h-4 text-gray-600" />
                    </button>
                    <input type="number" inputMode="decimal" min={MIN_DURATION_HOURS} max={MAX_DURATION_HOURS} step={DURATION_STEP_HOURS} value={String(durationHours)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) {
                          setDurationHours(Math.max(MIN_DURATION_HOURS, Math.min(MAX_DURATION_HOURS, Math.round(n * 2) / 2)));
                        }
                      }}
                      className="input-field w-24 text-center" />
                    <button type="button" onClick={() => setDurationHours((h) => Math.min(MAX_DURATION_HOURS, h + DURATION_STEP_HOURS))}
                      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-40"
                      disabled={durationHours >= MAX_DURATION_HOURS}>
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-gray-400">{formatCurrency(hourlyPrice)} × {formatDuration(durationHours)}</p>
                      <p className="text-lg font-extrabold text-green-600">{formatCurrency(finalPrice)}</p>
                    </div>
                  </div>
                </div>

                {/* Date + Time */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Date
                    </label>
                    <input type="date" required min={minDateStr} value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="label flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Start Time
                    </label>
                    <select required value={startHour} onChange={(e) => setStartHour(e.target.value)} className="input-field">
                      {availableStartHours.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {date === minDateStr && availableStartHours.length === 0 && (
                      <p className="text-xs text-red-500 font-semibold mt-1.5">
                        No more start times are available today.
                      </p>
                    )}
                  </div>
                </div>

                {date && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    Your session: <strong>{timeSlot}</strong> on <strong>{date}</strong>
                  </div>
                )}

                {/* Recurring schedule */}
                <div>
                  <label className="label flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Booking Schedule
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    {(["none", "monthly", "fortnightly", "weekly"] as RecurringFreq[]).map((value) => {
                      const label    = value === "none" ? "One-off" : value.charAt(0).toUpperCase() + value.slice(1);
                      const discount = liveDiscounts[value] ?? 0;
                      return (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setRecurringFreq(value)}
                        className={cn(
                          "relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 text-xs font-bold transition-all",
                          recurringFreq === value
                            ? "border-green-500 bg-green-50 text-green-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        )}
                      >
                        {discount > 0 && (
                          <span className="absolute -top-2 -right-1 bg-orange-500 text-white text-[10px] font-black px-1 py-0.5 rounded-full leading-none">
                            -{discount}%
                          </span>
                        )}
                        {label}
                      </button>
                      );
                    })}
                  </div>
                  {recurringFreq !== "none" && (
                    <p className="text-xs text-green-600 font-semibold mt-2 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {recurringPct}% off — saving {formatCurrency(totalPrice - finalPrice)} per visit
                    </p>
                  )}
                </div>

                <hr className="border-gray-100" />
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Service Address
                </p>

                <div>
                  <label className="label">Postcode</label>
                  <input type="text" required value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                    placeholder="CF10 1AB" className="input-field" />
                </div>

                <div>
                  <label className="label">Street Address</label>
                  <input type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
                    placeholder="12 High Street" className="input-field" />
                </div>

                <div>
                  <label className="label">City (Wales)</label>
                  <select required value={city} onChange={(e) => setCity(e.target.value)} className="input-field">
                    <option value="">Select city</option>
                    {walesCities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Special Instructions (optional)</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={3} placeholder="E.g. key under the mat, focus on kitchen..."
                    className="input-field resize-none" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
                    Back
                  </button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-60">
                    {submitting ? "Booking…" : `Confirm — ${formatCurrency(finalPrice)}`}
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
