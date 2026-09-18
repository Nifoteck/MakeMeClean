import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  CheckCircle,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  Minus,
  Plus,
  RefreshCw,
  Home,
  Bath,
  Bed,
  Sparkles,
  Layers,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  START_HOURS,
  calcTimeSlot,
  walesCities,
  fetchActiveCities,
  Service,
} from "@/lib/services";
import { cn, formatCurrency } from "@/lib/utils";
import {
  FREQ_LABELS,
  MIN_DURATION_HOURS,
  MAX_DURATION_HOURS,
  DURATION_STEP_HOURS,
} from "@/lib/constants";
import { useServices } from "@/hooks/useServices";
import { api } from "@/lib/apiClient";

type Step = 1 | 2 | 3;
type RecurringFreq = "none" | "weekly" | "fortnightly" | "monthly";

const EMPTY_DISCOUNTS: Record<RecurringFreq, number> = {
  none: 0,
  weekly: 0,
  fortnightly: 0,
  monthly: 0,
};

const DEFAULT_BOOKING_EXTRAS = [
  {
    id: "oven",
    label: "Inside Oven & Grill",
    icon: "🍳",
    duration: 0.75,
    desc: "Deep degreasing & rack soaking",
  },
  {
    id: "fridge",
    label: "Inside Fridge / Freezer",
    icon: "❄️",
    duration: 0.5,
    desc: "Shelves washed & sanitized",
  },
  {
    id: "windows",
    label: "Interior Window Glass",
    icon: "🪟",
    duration: 0.5,
    desc: "Internal panes & sills buffed",
  },
  {
    id: "ironing",
    label: "Ironing & Laundry",
    icon: "🧺",
    duration: 1.0,
    desc: "Shirts, linens & folding",
  },
  {
    id: "carpet",
    label: "Carpet Stain Extraction",
    icon: "🧹",
    duration: 1.0,
    desc: "Hot water shampoo machine",
  },
  {
    id: "cupboards",
    label: "Inside Kitchen Cabinets",
    icon: "📦",
    duration: 0.75,
    desc: "Shelves wiped & sanitized",
  },
];

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

  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Wecasa-Style Dynamic Room & Extras State (Configurable from Admin)
  const [availableExtras, setAvailableExtras] = useState(
    DEFAULT_BOOKING_EXTRAS
  );
  const [multipliers, setMultipliers] = useState({
    base: 2.0,
    bed: 0.5,
    bath: 0.5,
    living: 0.5,
  });

  const [propertyType, setPropertyType] = useState("House");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [livingRooms, setLivingRooms] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("09:00");
  const [durationHours, setDurationHours] = useState(3);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [citiesList, setCitiesList] = useState<string[]>(walesCities);
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [recurringFreq, setRecurringFreq] = useState<RecurringFreq>("none");
  const [liveDiscounts, setLiveDiscounts] =
    useState<Record<RecurringFreq, number>>(EMPTY_DISCOUNTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState("");

  // Recalculate recommended duration when rooms or extras change
  const computeRecommendedHours = (
    beds: number,
    baths: number,
    living: number,
    extras: string[],
    mults = multipliers,
    extList = availableExtras
  ) => {
    let rec = mults.base;
    if (beds > 1) rec += (beds - 1) * mults.bed;
    if (baths > 1) rec += (baths - 1) * mults.bath;
    if (living > 1) rec += (living - 1) * mults.living;

    for (const extraId of extras) {
      const found = extList.find((e) => e.id === extraId);
      if (found) rec += Number(found.duration) || 0.5;
    }
    return Math.max(
      MIN_DURATION_HOURS,
      Math.min(MAX_DURATION_HOURS, Math.round(rec * 2) / 2)
    );
  };

  const handleRoomChange = (
    newBeds: number,
    newBaths: number,
    newLiving: number,
    newExtras: string[]
  ) => {
    setBedrooms(newBeds);
    setBathrooms(newBaths);
    setLivingRooms(newLiving);
    setSelectedExtras(newExtras);
    const recommended = computeRecommendedHours(
      newBeds,
      newBaths,
      newLiving,
      newExtras,
      multipliers,
      availableExtras
    );
    setDurationHours(recommended);
  };

  const toggleExtra = (extraId: string) => {
    const updated = selectedExtras.includes(extraId)
      ? selectedExtras.filter((id) => id !== extraId)
      : [...selectedExtras, extraId];
    handleRoomChange(bedrooms, bathrooms, livingRooms, updated);
  };

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    fetchActiveCities().then((cities) => {
      if (cities && cities.length > 0) setCitiesList(cities);
    });
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryPostcode = searchParams.get("postcode");
    const queryCity = searchParams.get("city");
    if (queryPostcode) setPostcode(queryPostcode.toUpperCase());
    if (queryCity) setCity(queryCity);
  }, []);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "discount_weekly",
        "discount_fortnightly",
        "discount_monthly",
        "booking_extras",
        "room_calc_base_hours",
        "room_calc_bed_hours",
        "room_calc_bath_hours",
        "room_calc_living_hours",
      ])
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const map: Record<string, any> = {};
        for (const row of data) map[row.key] = row.value;

        setLiveDiscounts({
          none: 0,
          weekly: Number(map["discount_weekly"]) || 0,
          fortnightly: Number(map["discount_fortnightly"]) || 0,
          monthly: Number(map["discount_monthly"]) || 0,
        });

        const newMults = {
          base: Number(map["room_calc_base_hours"]) || 2.0,
          bed: Number(map["room_calc_bed_hours"]) || 0.5,
          bath: Number(map["room_calc_bath_hours"]) || 0.5,
          living: Number(map["room_calc_living_hours"]) || 0.5,
        };
        setMultipliers(newMults);

        let parsedExtras = DEFAULT_BOOKING_EXTRAS;
        if (map["booking_extras"]) {
          try {
            const p = JSON.parse(map["booking_extras"]);
            if (Array.isArray(p) && p.length > 0) {
              parsedExtras = p;
              setAvailableExtras(p);
            }
          } catch (_) {}
        }

        // Recompute initial duration with live admin settings
        const initialRec = computeRecommendedHours(
          bedrooms,
          bathrooms,
          livingRooms,
          selectedExtras,
          newMults,
          parsedExtras
        );
        setDurationHours(initialRec);
      });
  }, []);

  useEffect(() => {
    if (params.serviceId) {
      const s = services.find((s) => s.id === params.serviceId);
      if (s) {
        setSelectedService(s);
        setStep(2);
      }
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
          if (!address) setAddress(data.address ?? "");
          if (!city) setCity(data.city ?? "");
          if (!postcode) setPostcode(data.postcode ?? "");
        }
      });
  }, [user]);

  const minDate = new Date();
  const minDateStr = minDate.toISOString().split("T")[0];
  const baseHourlyPrice = selectedService?.price ?? 0;
  const svcDiscount = Math.max(
    0,
    Math.min(100, Number(selectedService?.discount_percent ?? 0))
  );
  const hourlyPrice =
    svcDiscount > 0
      ? baseHourlyPrice * (1 - svcDiscount / 100)
      : baseHourlyPrice;
  const totalPrice = hourlyPrice * durationHours;
  const recurringPct = liveDiscounts[recurringFreq] ?? 0;
  const finalPrice =
    recurringPct > 0 ? totalPrice * (1 - recurringPct / 100) : totalPrice;
  const timeSlot = calcTimeSlot(startHour, durationHours);
  const availableStartHours =
    date === minDateStr
      ? START_HOURS.filter(
          (h) => new Date(`${date}T${h}:00`).getTime() > Date.now()
        )
      : START_HOURS;

  useEffect(() => {
    if (
      date &&
      availableStartHours.length > 0 &&
      !availableStartHours.includes(startHour)
    ) {
      setStartHour(availableStartHours[0]);
    }
  }, [date, availableStartHours, startHour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService) return;
    if (availableStartHours.length === 0) {
      setError(
        "No future start times are available today. Please choose another date."
      );
      return;
    }
    if (durationHours < MIN_DURATION_HOURS) {
      setError(
        `Minimum booking duration is ${formatDuration(MIN_DURATION_HOURS)}.`
      );
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const result = await api.createBooking({
        serviceId: selectedService.id,
        date,
        startHour,
        durationHours,
        timeSlot,
        address,
        city,
        postcode,
        notes: notes || undefined,
        recurringFreq,
        bedrooms,
        bathrooms,
        livingRooms,
        extras: selectedExtras,
        propertyType,
      });

      const newBooking = result.booking || result;
      setBookingId(newBooking.id);
      setStep(3);
    } catch (err: any) {
      setError(err?.message || "Failed to submit booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (step === 3 && selectedService)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-3xl border border-gray-200 shadow-xl animate-fade-in">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-green-600">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            Booking Confirmed!
          </h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Your {selectedService.name} has been scheduled for{" "}
            <strong>{date}</strong> ({timeSlot}).
          </p>

          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-2 mb-6 text-xs text-gray-700 border border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-400">Layout:</span>
              <span className="font-bold">
                {bedrooms} Bed · {bathrooms} Bath · {livingRooms} Living (
                {propertyType})
              </span>
            </div>
            {selectedExtras.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Extras:</span>
                <span className="font-bold">{selectedExtras.join(", ")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Duration:</span>
              <span className="font-bold">{formatDuration(durationHours)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Address:</span>
              <span className="font-bold">
                {address}, {city} ({postcode})
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-bold">Total:</span>
              <span className="text-green-700 font-black text-sm">
                {formatCurrency(finalPrice)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {bookingId && (
              <button
                onClick={() => setLocation(`/pay/${bookingId}`)}
                className="btn-primary w-full py-3"
              >
                Proceed to Secure Payment
              </button>
            )}
            <button
              onClick={() =>
                setLocation(bookingId ? `/bookings/${bookingId}` : "/bookings")
              }
              className="btn-secondary w-full py-3 text-xs"
            >
              View in My Bookings
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50/70 py-8 md:py-14">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <Shield className="w-3.5 h-3.5 text-green-600" />
            £2M Insured · DBS Vetted · Cashless Payment
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900">
            Book a Professional Clean
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Customise your home size and requirements in under 2 minutes
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center mb-8 max-w-xl mx-auto">
          {[
            ["1", "Select Clean"],
            ["2", "Rooms & Details"],
            ["3", "Confirmation"],
          ].map(([n, label], i) => (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div
                className={`flex items-center gap-2 ${
                  parseInt(n) <= step ? "text-green-600" : "text-gray-300"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    parseInt(n) < step
                      ? "bg-green-600 border-green-600 text-white"
                      : parseInt(n) === step
                      ? "border-green-600 text-green-600 bg-white"
                      : "border-gray-200 text-gray-300 bg-white"
                  }`}
                >
                  {parseInt(n) < step ? "✓" : n}
                </div>
                <span className="text-xs font-bold hidden sm:block">
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    step > i + 1 ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 — Choose service */}
        {step === 1 && (
          <div className="animate-fade-in bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-black text-gray-900 mb-4">
              Choose your cleaning service
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {services.map((s) => {
                const sd = Math.max(
                  0,
                  Math.min(100, Number(s.discount_percent ?? 0))
                );
                const sp = sd > 0 ? s.price * (1 - sd / 100) : s.price;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedService(s);
                      setStep(2);
                    }}
                    className={`text-left p-4 rounded-2xl border transition-all duration-150 group hover:border-green-500 hover:shadow-md ${
                      selectedService?.id === s.id
                        ? "border-green-600 bg-green-50/50 ring-2 ring-green-500/20"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                        {s.image_url ? (
                          <img
                            src={s.image_url}
                            alt={s.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                            Clean
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm group-hover:text-green-700">
                          {s.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {s.description}
                        </div>
                        <div className="mt-2 text-green-700 font-black text-sm">
                          {formatCurrency(sp)}/hr
                          {sd > 0 && (
                            <span className="text-xs text-gray-400 line-through font-normal ml-1.5">
                              {formatCurrency(s.price)}/hr
                            </span>
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

        {/* Step 2 — Wecasa Room Calculator & Booking Form */}
        {step === 2 && selectedService && (
          <div className="animate-fade-in space-y-6">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-green-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Choose a different service
            </button>

            {/* Service Summary Banner */}
            <div className="bg-white p-5 rounded-2xl border border-green-200 bg-green-50/40 flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-green-200 bg-white shrink-0">
                  {selectedService.image_url ? (
                    <img
                      src={selectedService.image_url}
                      alt={selectedService.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      Clean
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {selectedService.name}
                  </h3>
                  <p className="text-xs text-green-700 font-semibold">
                    {formatCurrency(hourlyPrice)}/hr · Eco supplies included
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-green-700">
                  {formatCurrency(finalPrice)}
                </div>
                <div className="text-[11px] text-gray-500">
                  for {formatDuration(durationHours)}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl px-4 py-3 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ── 1. Wecasa-Style Room & Property Calculator ───────── */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xs space-y-6">
                <div>
                  <p className="section-eyebrow">
                    <Home className="w-3.5 h-3.5" /> Step A · Property Layout
                  </p>
                  <h3 className="text-lg font-black text-gray-900">
                    Tell us about your home
                  </h3>
                  <p className="text-xs text-gray-500">
                    We'll automatically calculate the optimal cleaning time
                    based on room count.
                  </p>
                </div>

                {/* Property Type Selector */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-2">
                    Property Type
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {["House", "Flat / Apartment", "Studio / HMO"].map(
                      (type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setPropertyType(type)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                            propertyType === type
                              ? "bg-green-600 text-white border-green-600 shadow-xs"
                              : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {type}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Room Counters Grid */}
                <div className="grid sm:grid-cols-3 gap-4 pt-2">
                  {/* Bedrooms */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1">
                        <Bed className="w-3.5 h-3.5 text-green-600" /> Bedrooms
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Sleep & storage
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            Math.max(1, bedrooms - 1),
                            bathrooms,
                            livingRooms,
                            selectedExtras
                          )
                        }
                        disabled={bedrooms <= 1}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-black text-sm w-4 text-center">
                        {bedrooms}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            Math.min(8, bedrooms + 1),
                            bathrooms,
                            livingRooms,
                            selectedExtras
                          )
                        }
                        disabled={bedrooms >= 8}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bathrooms */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1">
                        <Bath className="w-3.5 h-3.5 text-green-600" />{" "}
                        Bathrooms
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Shower & WC
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            bedrooms,
                            Math.max(1, bathrooms - 1),
                            livingRooms,
                            selectedExtras
                          )
                        }
                        disabled={bathrooms <= 1}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-black text-sm w-4 text-center">
                        {bathrooms}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            bedrooms,
                            Math.min(6, bathrooms + 1),
                            livingRooms,
                            selectedExtras
                          )
                        }
                        disabled={bathrooms >= 6}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Living Rooms */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-green-600" /> Living
                        Areas
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Lounge & dining
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            bedrooms,
                            bathrooms,
                            Math.max(1, livingRooms - 1),
                            selectedExtras
                          )
                        }
                        disabled={livingRooms <= 1}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-black text-sm w-4 text-center">
                        {livingRooms}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            bedrooms,
                            bathrooms,
                            Math.min(5, livingRooms + 1),
                            selectedExtras
                          )
                        }
                        disabled={livingRooms >= 5}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Optional Extras Tiles */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-2.5">
                    Specialist Extras (Optional)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {AVAILABLE_EXTRAS.map((extra) => {
                      const isSelected = selectedExtras.includes(extra.id);
                      return (
                        <button
                          key={extra.id}
                          type="button"
                          onClick={() => toggleExtra(extra.id)}
                          className={`p-3 rounded-2xl text-left border transition-all ${
                            isSelected
                              ? "border-green-600 bg-green-50/70 shadow-xs ring-1 ring-green-600"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-lg">{extra.icon}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                isSelected
                                  ? "bg-green-600 text-white"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              +{extra.duration * 60}m
                            </span>
                          </div>
                          <div className="font-bold text-xs text-gray-900">
                            {extra.label}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                            {extra.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recommendation & Manual Hour Adjuster */}
                <div className="p-4 rounded-2xl bg-green-50/60 border border-green-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-green-700 shrink-0" />
                    <div className="text-xs text-gray-700">
                      Recommended for{" "}
                      <strong>
                        {bedrooms} bed, {bathrooms} bath
                      </strong>{" "}
                      {selectedExtras.length > 0 && (
                        <span>+ {selectedExtras.length} extras</span>
                      )}
                      :{" "}
                      <strong>
                        {formatDuration(
                          computeRecommendedHours(
                            bedrooms,
                            bathrooms,
                            livingRooms,
                            selectedExtras
                          )
                        )}
                      </strong>
                    </div>
                  </div>

                  {/* Manual Hours Adjuster */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 font-semibold mr-1">
                      Hours:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDurationHours((h) =>
                          Math.max(MIN_DURATION_HOURS, h - DURATION_STEP_HOURS)
                        )
                      }
                      disabled={durationHours <= MIN_DURATION_HOURS}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-12 text-center text-sm font-black text-gray-900">
                      {durationHours}h
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDurationHours((h) =>
                          Math.min(MAX_DURATION_HOURS, h + DURATION_STEP_HOURS)
                        )
                      }
                      disabled={durationHours >= MAX_DURATION_HOURS}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 2. Date, Time & Frequency ───────────────────────── */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xs space-y-5">
                <p className="section-eyebrow">
                  <Calendar className="w-3.5 h-3.5" /> Step B · Schedule
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Preferred Date
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
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Start Time Slot
                    </label>
                    <select
                      required
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="input-field"
                    >
                      {availableStartHours.map((h) => (
                        <option key={h} value={h}>
                          {h} (Finishes at{" "}
                          {calcTimeSlot(h, durationHours).split(" – ")[1]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {date && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-800 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                    <span>
                      Clean scheduled: <strong>{date}</strong> from{" "}
                      <strong>{timeSlot}</strong>
                    </span>
                  </div>
                )}

                {/* Recurring schedule */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-2">
                    Repeat Clean (Save up to 15%)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        "none",
                        "monthly",
                        "fortnightly",
                        "weekly",
                      ] as RecurringFreq[]
                    ).map((value) => {
                      const label =
                        value === "none"
                          ? "One-off"
                          : value.charAt(0).toUpperCase() + value.slice(1);
                      const discount = liveDiscounts[value] ?? 0;
                      return (
                        <button
                          type="button"
                          key={value}
                          onClick={() => setRecurringFreq(value)}
                          className={cn(
                            "relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-xs font-bold transition-all",
                            recurringFreq === value
                              ? "border-green-600 bg-green-50 text-green-800 shadow-xs"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          )}
                        >
                          {discount > 0 && (
                            <span className="absolute -top-2 -right-1 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                              -{discount}%
                            </span>
                          )}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── 3. Address & Access Notes ───────────────────────── */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                <p className="section-eyebrow">
                  <MapPin className="w-3.5 h-3.5" /> Step C · Location & Keys
                </p>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Postcode
                    </label>
                    <input
                      type="text"
                      required
                      value={postcode}
                      onChange={(e) =>
                        setPostcode(e.target.value.toUpperCase())
                      }
                      placeholder="CF10 1AB"
                      className="input-field uppercase"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      City / Town (Wales)
                    </label>
                    <select
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Select city/town</option>
                      {citiesList.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    Street Address & Flat Number
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Flat 4, 12 Cathedral Road"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">
                    Access Notes & Special Instructions (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="E.g. key in lockbox code 1234, friendly dog in utility room, focus on kitchen tiles..."
                    className="input-field resize-none text-xs"
                  />
                </div>
              </div>

              {/* ── 4. Submit Bar ──────────────────────────────────── */}
              <div className="p-6 bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                    Total Payable
                  </div>
                  <div className="text-2xl font-black text-green-700">
                    {formatCurrency(finalPrice)}{" "}
                    <span className="text-xs font-normal text-gray-500">
                      ({formatDuration(durationHours)} @{" "}
                      {formatCurrency(hourlyPrice)}/hr)
                    </span>
                  </div>
                  {recurringPct > 0 && (
                    <div className="text-[11px] font-semibold text-orange-600">
                      Includes {recurringPct}% repeat booking discount!
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-secondary py-3 px-5 text-xs w-1/3 sm:w-auto"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary py-3 px-8 text-sm font-bold flex-1 sm:flex-none shadow-md shadow-green-600/20"
                  >
                    {submitting ? "Booking…" : "Confirm Booking"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
