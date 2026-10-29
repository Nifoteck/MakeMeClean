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
  Repeat,
  CheckCircle2,
  Home,
  Bath,
  Bed,
  Sparkles,
  Layers,
  Shield,
  Key,
  Car,
  Dog,
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
  BOOKING_PROPERTY_TYPES,
  ACCESS_METHODS,
  CLEANING_SUPPLIES_OPTIONS,
  calculateRecommendedHours,
  DEFAULT_BOOKING_EXTRAS,
  DEFAULT_DURATION_MULTIPLIERS,
  DURATION_STEP_HOURS,
  MAX_DURATION_HOURS,
  MAX_ROOM_COUNTS,
  MIN_DURATION_HOURS,
  parseBookingExtras,
  parseDurationMultipliers,
} from "@/lib/constants";
import type { BookingDurationMultipliers, BookingExtra } from "@/lib/constants";
import { useServices } from "@/hooks/useServices";
import { api } from "@/lib/apiClient";
import { getServiceBookingConfig } from "@/lib/serviceBookingConfigs";
import { WECASA_SERVICE_GROUPS } from "@/lib/wecasaServices";

type Step = 1 | 2 | 3;
type RecurringFreq = "none" | "weekly" | "fortnightly" | "monthly";

const EMPTY_DISCOUNTS: Record<RecurringFreq, number> = {
  none: 0,
  weekly: 0,
  fortnightly: 0,
  monthly: 0,
};

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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Wecasa-Style Dynamic Room & Extras State (Configurable from Admin)
  const [availableExtras, setAvailableExtras] = useState<BookingExtra[]>(
    DEFAULT_BOOKING_EXTRAS
  );
  const [multipliers, setMultipliers] = useState<BookingDurationMultipliers>(
    DEFAULT_DURATION_MULTIPLIERS
  );

  const [propertyType, setPropertyType] = useState("House / Flat");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [livingRooms, setLivingRooms] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("09:00");
  const [durationHours, setDurationHours] = useState(() =>
    calculateRecommendedHours(2, 1, 1, [])
  );
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [citiesList, setCitiesList] = useState<string[]>(walesCities);
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [accessMethod, setAccessMethod] = useState("home");
  const [suppliesOption, setSuppliesOption] = useState("cleaner");
  const [parkingOption, setParkingOption] = useState("free");
  const [hasPets, setHasPets] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<RecurringFreq>("none");
  const [liveDiscounts, setLiveDiscounts] =
    useState<Record<RecurringFreq, number>>(EMPTY_DISCOUNTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState("");

  const bookingConfig = getServiceBookingConfig(
    selectedService?.id || selectedService?.name || ""
  );

  // Dynamic estimate calculation based on service category
  const computeRecommendedHours = (
    val1: number,
    val2: number,
    val3: number,
    extras: string[],
    mults = multipliers,
    extList = availableExtras
  ) => {
    if (bookingConfig.category === "ironing") {
      // Ironing: val1 = baskets (1h each), val2 = delicates (0.1h each), val3 = linen sets (0.35h each)
      let hours =
        val1 * bookingConfig.field1.unitMultiplier +
        val2 * bookingConfig.field2.unitMultiplier +
        val3 * bookingConfig.field3.unitMultiplier;
      for (const extraId of new Set(extras)) {
        const extra = bookingConfig.extras.find((item) => item.id === extraId);
        if (extra) hours += extra.duration;
      }
      return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
    }

    if (bookingConfig.category === "office") {
      // Office: val1 = desks (0.1h each), val2 = washrooms (0.5h each), val3 = meeting rooms (0.5h each)
      let hours =
        1.0 +
        val1 * bookingConfig.field1.unitMultiplier +
        val2 * bookingConfig.field2.unitMultiplier +
        val3 * bookingConfig.field3.unitMultiplier;
      for (const extraId of new Set(extras)) {
        const extra = bookingConfig.extras.find((item) => item.id === extraId);
        if (extra) hours += extra.duration;
      }
      return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
    }

    if (bookingConfig.category === "cleaning_ironing") {
      // Cleaning + Ironing: val1 = beds, val2 = baths, val3 = ironing baskets
      let hours = 1.5 + val1 * 0.5 + val2 * 0.5 + val3 * 1.0;
      for (const extraId of new Set(extras)) {
        const extra = bookingConfig.extras.find((item) => item.id === extraId);
        if (extra) hours += extra.duration;
      }
      return Math.max(MIN_DURATION_HOURS, Math.round(hours * 2) / 2);
    }

    // Standard Domestic or Airbnb
    return calculateRecommendedHours(
      val1,
      val2,
      val3,
      extras,
      mults,
      bookingConfig.category === "airbnb" ? bookingConfig.extras : extList
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
    // Allow going up to 30 minutes lower than recommended (down to MIN_DURATION_HOURS)
    const allowedFloor = Math.max(
      MIN_DURATION_HOURS,
      recommended - DURATION_STEP_HOURS
    );
    setDurationHours((current) =>
      Math.min(MAX_DURATION_HOURS, Math.max(allowedFloor, current))
    );
  };

  const handlePropertyTypeChange = (nextType: string) => {
    setPropertyType(nextType);
    if (bookingConfig.category === "domestic" && nextType === "Studio") {
      // Studio: open-plan living/sleeping layout with 0 separate bedrooms
      handleRoomChange(0, Math.max(1, bathrooms || 1), 1, selectedExtras);
    } else if (
      bookingConfig.category === "domestic" &&
      nextType === "HMO / Shared House"
    ) {
      // HMO: 1 private bedroom, 1 shared bathroom, 0 separate living
      handleRoomChange(
        1,
        Math.max(1, bathrooms || 1),
        Math.min(1, livingRooms),
        selectedExtras
      );
    } else {
      handleRoomChange(
        Math.max(
          bookingConfig.field1.min,
          bedrooms || bookingConfig.field1.default
        ),
        Math.max(
          bookingConfig.field2.min,
          bathrooms || bookingConfig.field2.default
        ),
        Math.max(
          bookingConfig.field3.min,
          livingRooms || bookingConfig.field3.default
        ),
        selectedExtras
      );
    }
  };

  const recommendedDurationHours = computeRecommendedHours(
    bedrooms,
    bathrooms,
    livingRooms,
    selectedExtras
  );
  const requiresManualQuote = recommendedDurationHours > MAX_DURATION_HOURS;
  // Customers can adjust duration up to 30 mins below recommendation (floor: 1.5h)
  const allowedFloorHours = Math.max(
    MIN_DURATION_HOURS,
    recommendedDurationHours - DURATION_STEP_HOURS
  );
  const bedroomLabel = bookingConfig.field1.label;
  const bedroomHint = bookingConfig.field1.hint;
  const bathroomLabel = bookingConfig.field2.label;
  const bathroomHint = bookingConfig.field2.hint;
  const livingAreaLabel = bookingConfig.field3.label;
  const livingAreaHint = bookingConfig.field3.hint;

  const currentAvailableExtras =
    bookingConfig.category === "domestic"
      ? availableExtras
      : bookingConfig.extras;

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
    const qType = searchParams.get("propertyType");
    const qBeds = searchParams.get("bedrooms");
    const qBaths = searchParams.get("bathrooms");
    const qLiving = searchParams.get("livingRooms");
    if (qType) setPropertyType(qType);
    if (qBeds != null && !isNaN(Number(qBeds))) setBedrooms(Number(qBeds));
    if (qBaths != null && !isNaN(Number(qBaths))) setBathrooms(Number(qBaths));
    if (qLiving != null && !isNaN(Number(qLiving)))
      setLivingRooms(Number(qLiving));
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
      .then(({ data, error: settingsError }) => {
        if (settingsError) {
          setError(
            "We couldn't load the cleaning estimate settings. Please try again."
          );
          return;
        }

        const map: Record<string, any> = {};
        for (const row of data || []) map[row.key] = row.value;

        setLiveDiscounts({
          none: 0,
          weekly: Number(map["discount_weekly"]) || 0,
          fortnightly: Number(map["discount_fortnightly"]) || 0,
          monthly: Number(map["discount_monthly"]) || 0,
        });

        const newMults = parseDurationMultipliers(map);
        if (!newMults) {
          setError(
            "The cleaning estimate settings are invalid. Please contact us."
          );
          return;
        }
        setMultipliers(newMults);

        const parsedExtras = parseBookingExtras(map["booking_extras"]);
        if (!parsedExtras) {
          setError(
            "The cleaning extras settings are invalid. Please contact us."
          );
          return;
        }
        setAvailableExtras(parsedExtras);

        // Recompute initial duration with live admin settings
        const initialRec = computeRecommendedHours(
          bedrooms,
          bathrooms,
          livingRooms,
          selectedExtras,
          newMults,
          parsedExtras
        );
        setDurationHours(Math.min(MAX_DURATION_HOURS, initialRec));
      });
  }, []);

  useEffect(() => {
    if (params.serviceId) {
      const s = services.find((s) => s.id === params.serviceId);
      if (s) {
        setSelectedService(s);
        const cfg = getServiceBookingConfig(s.id || s.name);
        setPropertyType(cfg.defaultPropertyType);
        setBedrooms(cfg.field1.default);
        setBathrooms(cfg.field2.default);
        setLivingRooms(cfg.field3.default);
        setSelectedExtras([]);
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
    if (
      bedrooms === 0 &&
      bathrooms === 0 &&
      livingRooms === 0 &&
      selectedExtras.length === 0
    ) {
      setError(
        "Please select at least one room or specialist extra to be cleaned."
      );
      return;
    }
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
    if (requiresManualQuote) {
      setError(
        `This clean needs more than ${MAX_DURATION_HOURS} hours. Please contact us for a tailored quote.`
      );
      return;
    }
    if (durationHours < allowedFloorHours) {
      setError(
        `The rooms and extras selected require at least ${formatDuration(
          allowedFloorHours
        )} (30 minutes below recommendation).`
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
        accessMethod,
        suppliesOption,
        parkingOption,
        hasPets,
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
                {bookingConfig.formatLayout(
                  bedrooms,
                  bathrooms,
                  livingRooms,
                  propertyType
                )}
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
              <span className="text-gray-400">Supplies:</span>
              <span className="font-bold">
                {suppliesOption === "cleaner"
                  ? "Cleaner brings supplies"
                  : "Customer provides"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Access:</span>
              <span className="font-bold">
                {ACCESS_METHODS.find((m) => m.id === accessMethod)?.label ||
                  accessMethod}
              </span>
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
            Fully Insured · DBS Vetted · Cashless Payment
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
          <div className="animate-fade-in space-y-6">
            <div className="text-center max-w-xl mx-auto mb-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                Select your service
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose the service category tailored to your property. Customize hours, rooms, and extras in Step 2.
              </p>
            </div>

            {/* Wecasa-Style 5 Distinct Main Categories */}
            <div className="grid md:grid-cols-2 gap-4">
              {WECASA_SERVICE_GROUPS.map((group) => {
                const matchedDbService =
                  services.find((s) => s.id === group.primaryServiceId) ||
                  services.find((s) => s.name.toLowerCase().includes(group.id)) ||
                  services[0];

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      if (!matchedDbService) return;
                      setSelectedService(matchedDbService);
                      const cfg = getServiceBookingConfig(matchedDbService.id || matchedDbService.name);
                      setPropertyType(cfg.defaultPropertyType);
                      setBedrooms(cfg.field1.default);
                      setBathrooms(cfg.field2.default);
                      setLivingRooms(cfg.field3.default);
                      setSelectedExtras([]);
                      setStep(2);
                    }}
                    className="p-6 rounded-3xl border-2 border-gray-200 bg-white hover:border-green-600 hover:shadow-lg transition-all text-left flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                        {group.icon}
                      </div>
                      <div className="flex flex-col items-end">
                        {group.badge && (
                          <span className="bg-green-100 text-green-800 text-[11px] font-black px-2.5 py-0.5 rounded-full mb-1">
                            {group.badge}
                          </span>
                        )}
                        <span className="text-sm font-black text-green-700">
                          {group.hourlyRateRange}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-gray-900 group-hover:text-green-700 transition-colors">
                        {group.name}
                      </h3>
                      <p className="text-xs font-semibold text-green-700 mt-0.5">
                        {group.tagline}
                      </p>
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                        {group.description}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-700 group-hover:text-green-700">
                      <span>Select & customize</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
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
                    <Home className="w-3.5 h-3.5" /> Step A ·{" "}
                    {bookingConfig.propertyTypeLabel} & Scale
                  </p>
                  <h3 className="text-lg font-black text-gray-900">
                    {bookingConfig.stepATitle}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {bookingConfig.stepASubtitle}
                  </p>
                </div>

                {/* Property Type Selector */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-2">
                    {bookingConfig.propertyTypeLabel}
                  </label>
                  <div
                    className={`grid grid-cols-${bookingConfig.propertyTypes.length} gap-2 sm:gap-3`}
                  >
                    {bookingConfig.propertyTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={propertyType === type}
                        onClick={() => handlePropertyTypeChange(type)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                          propertyType === type
                            ? "bg-green-600 text-white border-green-600 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Room Counters Grid */}
                <div className="grid sm:grid-cols-3 gap-4 pt-2">
                  {/* Field 1 (Bedrooms / Baskets / Desks) */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <span className="text-base">
                          {bookingConfig.field1.icon}
                        </span>{" "}
                        {bedroomLabel}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {bedroomHint}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            Math.max(bookingConfig.field1.min, bedrooms - 1),
                            bathrooms,
                            livingRooms,
                            selectedExtras
                          )
                        }
                        disabled={bedrooms <= bookingConfig.field1.min}
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
                            Math.min(bookingConfig.field1.max, bedrooms + 1),
                            bathrooms,
                            livingRooms,
                            selectedExtras
                          )
                        }
                        disabled={bedrooms >= bookingConfig.field1.max}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Field 2 (Bathrooms / Delicates / Washrooms) */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <span className="text-base">
                          {bookingConfig.field2.icon}
                        </span>{" "}
                        {bathroomLabel}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {bathroomHint}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            bedrooms,
                            Math.max(bookingConfig.field2.min, bathrooms - 1),
                            livingRooms,
                            selectedExtras
                          )
                        }
                        disabled={bathrooms <= bookingConfig.field2.min}
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
                            Math.min(bookingConfig.field2.max, bathrooms + 1),
                            livingRooms,
                            selectedExtras
                          )
                        }
                        disabled={bathrooms >= bookingConfig.field2.max}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 font-bold disabled:opacity-30 hover:bg-gray-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Field 3 (Living Areas / Linen Sets / Meeting Rooms) */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <span className="text-base">
                          {bookingConfig.field3.icon}
                        </span>{" "}
                        {livingAreaLabel}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {livingAreaHint}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleRoomChange(
                            bedrooms,
                            bathrooms,
                            Math.max(bookingConfig.field3.min, livingRooms - 1),
                            selectedExtras
                          )
                        }
                        disabled={livingRooms <= bookingConfig.field3.min}
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
                            Math.min(bookingConfig.field3.max, livingRooms + 1),
                            selectedExtras
                          )
                        }
                        disabled={livingRooms >= bookingConfig.field3.max}
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
                    {currentAvailableExtras.map((extra) => {
                      const isSelected = selectedExtras.includes(extra.id);
                      return (
                        <button
                          key={extra.id}
                          type="button"
                          aria-pressed={isSelected}
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
                        {bookingConfig.formatLayout(
                          bedrooms,
                          bathrooms,
                          livingRooms,
                          propertyType
                        )}
                      </strong>{" "}
                      {selectedExtras.length > 0 && (
                        <span>+ {selectedExtras.length} extras</span>
                      )}
                      :{" "}
                      <strong>
                        {formatDuration(recommendedDurationHours)}
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
                          Math.max(allowedFloorHours, h - DURATION_STEP_HOURS)
                        )
                      }
                      title={
                        durationHours <= allowedFloorHours
                          ? `Minimum allowed duration for your selection is ${formatDuration(
                              allowedFloorHours
                            )}`
                          : "Decrease duration by 30 mins"
                      }
                      disabled={durationHours <= allowedFloorHours}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
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
                      title="Add extra time for a deeper clean"
                      disabled={durationHours >= MAX_DURATION_HOURS}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {durationHours < recommendedDurationHours && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2">
                    ⚡ You have chosen {formatDuration(durationHours)} (30 mins
                    less than our recommended{" "}
                    {formatDuration(recommendedDurationHours)}). Our cleaners
                    will focus on your top priorities within this booking time.
                  </p>
                )}
                {requiresManualQuote && (
                  <p
                    role="status"
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900"
                  >
                    This property and selection need more than{" "}
                    {MAX_DURATION_HOURS} hours. Please contact us for a tailored
                    quote rather than shortening the estimated clean.
                  </p>
                )}
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

                {/* Recurring schedule & Routine matching */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-green-600" /> Cleaning
                      Frequency
                    </label>
                    <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200/80 px-2 py-0.5 rounded-full">
                      Lock in your regular cleaner
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        {
                          id: "weekly",
                          label: "Weekly",
                          sub: "Most popular",
                          discountKey: "weekly",
                        },
                        {
                          id: "fortnightly",
                          label: "Fortnightly",
                          sub: "Every 2 weeks",
                          discountKey: "fortnightly",
                        },
                        {
                          id: "monthly",
                          label: "Monthly",
                          sub: "Every 4 weeks",
                          discountKey: "monthly",
                        },
                        {
                          id: "none",
                          label: "One-off",
                          sub: "Single visit",
                          discountKey: "none",
                        },
                      ] as const
                    ).map((freq) => {
                      const isSelected = recurringFreq === freq.id;
                      const discount =
                        liveDiscounts[freq.discountKey as RecurringFreq] ?? 0;
                      return (
                        <button
                          type="button"
                          key={freq.id}
                          onClick={() =>
                            setRecurringFreq(freq.id as RecurringFreq)
                          }
                          className={cn(
                            "relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all",
                            isSelected
                              ? "border-green-600 bg-green-50/70 text-green-900 ring-2 ring-green-600/20 shadow-xs"
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50/50"
                          )}
                        >
                          {discount > 0 && (
                            <span className="absolute -top-2 -right-1 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                              SAVE {discount}%
                            </span>
                          )}
                          <span className="font-black text-xs">
                            {freq.label}
                          </span>
                          <span className="text-[10px] text-gray-400 font-normal mt-0.5">
                            {freq.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Frequency Explanation & Benefits Banner */}
                  {recurringFreq !== "none" ? (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        Dedicated regular cleaner guaranteed
                      </div>
                      <p className="text-[11px] text-emerald-700/90 leading-relaxed">
                        {date ? (
                          <>
                            Your clean will recur{" "}
                            <strong>
                              {recurringFreq === "weekly"
                                ? "every week"
                                : recurringFreq === "fortnightly"
                                ? "every 2 weeks"
                                : "every 4 weeks"}
                            </strong>{" "}
                            on{" "}
                            <strong>
                              {new Date(date + "T12:00:00").toLocaleDateString(
                                "en-GB",
                                { weekday: "long" }
                              )}
                              s
                            </strong>{" "}
                            at <strong>{startHour}</strong>.
                          </>
                        ) : (
                          <>
                            Selecting a start date will anchor your recurring
                            slot for the same weekday and time.
                          </>
                        )}{" "}
                        You can skip weeks, pause for holidays, or cancel
                        anytime online with zero cancellation fee.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 text-[11px] text-gray-500 flex items-center justify-between">
                      <span>
                        Tip: Choose Weekly or Fortnightly to save up to 15% and
                        get the same cleaner on every visit.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 3. Address & Access Notes ───────────────────────── */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xs space-y-4">
                <p className="section-eyebrow">
                  <MapPin className="w-3.5 h-3.5" /> Step C · Location & Keys
                </p>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-2">
                    <Key className="w-3.5 h-3.5 inline mr-1 text-green-600" />{" "}
                    How should our cleaner access your property?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    {ACCESS_METHODS.map((method) => (
                      <button
                        type="button"
                        key={method.id}
                        onClick={() => setAccessMethod(method.id)}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all",
                          accessMethod === method.id
                            ? "border-green-600 bg-green-50/70 shadow-xs ring-1 ring-green-600"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        )}
                      >
                        <div className="font-bold text-xs text-gray-900">
                          {method.label}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                          {method.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-2">
                    <Sparkles className="w-3.5 h-3.5 inline mr-1 text-green-600" />{" "}
                    {bookingConfig.suppliesPrompt}
                  </label>
                  <div className="grid sm:grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setSuppliesOption("cleaner")}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all",
                        suppliesOption === "cleaner"
                          ? "border-green-600 bg-green-50/70 shadow-xs ring-1 ring-green-600"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      <div className="font-bold text-xs text-gray-900">
                        {bookingConfig.suppliesCleanerLabel}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Eco sprays, cloths & equipment arranged
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuppliesOption("customer")}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all",
                        suppliesOption === "customer"
                          ? "border-green-600 bg-green-50/70 shadow-xs ring-1 ring-green-600"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      <div className="font-bold text-xs text-gray-900">
                        {bookingConfig.suppliesCustomerLabel}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Cleaner uses items provided on site
                      </div>
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-gray-500" /> Parking
                      arrangements
                    </label>
                    <select
                      value={parkingOption}
                      onChange={(e) => setParkingOption(e.target.value)}
                      className="input-field text-xs bg-white"
                    >
                      <option value="free">
                        Free on-street / driveway parking
                      </option>
                      <option value="permit">
                        Visitor permit provided on arrival
                      </option>
                      <option value="paid">Paid parking meter nearby</option>
                      <option value="none">
                        No parking available (public transport only)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1">
                      <Dog className="w-3.5 h-3.5 text-gray-500" /> Pets at home
                    </label>
                    <button
                      type="button"
                      onClick={() => setHasPets(!hasPets)}
                      className={cn(
                        "w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all bg-white",
                        hasPets
                          ? "border-green-600 bg-green-50/50 text-green-800"
                          : "border-gray-200 text-gray-600"
                      )}
                    >
                      <span>
                        {hasPets
                          ? "🐾 Yes, pets at property"
                          : "No pets at property"}
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        Click to toggle
                      </span>
                    </button>
                  </div>
                </div>
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
                    disabled={submitting || requiresManualQuote}
                    className="btn-primary py-3 px-8 text-sm font-bold flex-1 sm:flex-none shadow-md shadow-green-600/20"
                  >
                    {submitting
                      ? "Booking…"
                      : requiresManualQuote
                      ? "Contact us for a quote"
                      : "Confirm Booking"}
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
