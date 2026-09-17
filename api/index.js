// api/_lib/server.ts
import { createClient } from "@supabase/supabase-js";
function getEnv(name, fallback = "") {
  const aliases = {
    SUPABASE_URL: ["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    SUPABASE_ANON_KEY: ["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY", "ANON_KEY", "VITE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    SUPABASE_SERVICE_ROLE_KEY: ["SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"],
    TELEGRAM_BOT_TOKEN: ["TELEGRAM_BOT_TOKEN", "VITE_TELEGRAM_BOT_TOKEN", "BOT_TOKEN"],
    TELEGRAM_CHAT_ID: ["TELEGRAM_CHAT_ID", "VITE_TELEGRAM_CHAT_ID", "TELEGRAM_ADMIN_CHAT_ID", "VITE_TELEGRAM_ADMIN_CHAT_ID"],
    TELEGRAM_ADMIN_CHAT_ID: ["TELEGRAM_ADMIN_CHAT_ID", "VITE_TELEGRAM_ADMIN_CHAT_ID", "TELEGRAM_CHAT_ID", "VITE_TELEGRAM_CHAT_ID"],
    SITE_URL: ["SITE_URL", "VITE_SITE_URL", "NEXT_PUBLIC_SITE_URL"],
    STRIPE_SECRET_KEY: ["STRIPE_SECRET_KEY", "VITE_STRIPE_SECRET_KEY"],
    STRIPE_WEBHOOK_SECRET: ["STRIPE_WEBHOOK_SECRET", "VITE_STRIPE_WEBHOOK_SECRET"],
    GROQ_API_KEY: ["GROQ_API_KEY", "VITE_GROQ_API_KEY"]
  };
  const keysToCheck = aliases[name] || [name, `VITE_${name}`, `NEXT_PUBLIC_${name}`];
  for (const k of keysToCheck) {
    if (process.env[k]) return process.env[k];
  }
  return fallback;
}
var SUPABASE_URL = getEnv("SUPABASE_URL");
var SUPABASE_ANON_KEY = getEnv("SUPABASE_ANON_KEY");
var SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
var SITE_URL = getEnv("SITE_URL", "https://makemeclean.co.uk").replace(/\/$/, "");
var STRIPE_SECRET_KEY = getEnv("STRIPE_SECRET_KEY", "");
var TELEGRAM_BOT_TOKEN = getEnv("TELEGRAM_BOT_TOKEN", "");
var TELEGRAM_CHAT_ID = getEnv("TELEGRAM_CHAT_ID", "");
function getServerSupabase(token) {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: token ? {
      headers: {
        Authorization: `Bearer ${token}`
      }
    } : void 0
  });
}
function handleCors(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}
function sendJson(res, status, data) {
  return res.status(status).json(data);
}
function sendSuccess(res, data, status = 200) {
  return sendJson(res, status, { ok: true, data });
}
function sendError(res, message, status = 400, details) {
  return sendJson(res, status, { ok: false, error: message, ...details ? { details } : {} });
}
function extractBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
async function verifyAuth(req) {
  const token = extractBearerToken(req);
  if (!token) {
    return { user: null, supabase: getServerSupabase(), error: "Missing or invalid Authorization header" };
  }
  const supabase = getServerSupabase(token);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { user: null, supabase, error: error?.message || "Unauthorized" };
    }
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role
      },
      supabase
    };
  } catch (err) {
    return { user: null, supabase, error: err?.message || "Authentication error" };
  }
}
var START_HOURS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00"
];
var MIN_DURATION_HOURS = 1.5;
var MAX_DURATION_HOURS = 12;
var DURATION_STEP_HOURS = 0.5;
function calcTimeSlot(startHour, durationHours) {
  const [h, m] = startHour.split(":").map(Number);
  const startMins = (h || 0) * 60 + (m || 0);
  const endMins = startMins + Math.round(durationHours * 60);
  const endH = Math.floor(endMins / 60);
  const endM = endMins % 60;
  const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return `${startHour} \u2013 ${endStr}`;
}
function calculateDurationHours(timeSlot) {
  if (!timeSlot) return 2;
  const parts = timeSlot.split(/[-–]/).map((s) => s.trim());
  if (parts.length < 2) return 2;
  const [startH, startM] = (parts[0] || "09:00").split(":").map(Number);
  const [endH, endM] = (parts[1] || "11:00").split(":").map(Number);
  const startMins = (startH || 0) * 60 + (startM || 0);
  const endMins = (endH || 0) * 60 + (endM || 0);
  const diff = (endMins - startMins) / 60;
  return diff > 0 ? diff : 2;
}
function generateInvoiceNumber() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const randomSuffix = Math.floor(1e3 + Math.random() * 9e3);
  return `INV-${year}${month}${day}-${randomSuffix}`;
}
function resolveServiceImageUrl(serviceId, dbImageUrl) {
  if (dbImageUrl && dbImageUrl.startsWith("http")) {
    return dbImageUrl;
  }
  const fallbacks = {
    "standard-cleaning": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80",
    "regular-cleaning": "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&auto=format&fit=crop&q=80",
    "one-off-cleaning": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80",
    "deep-cleaning": "https://images.unsplash.com/photo-1585421514738-01798e348b17?w=800&auto=format&fit=crop&q=80",
    "spring-cleaning": "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&auto=format&fit=crop&q=80",
    "same-day-cleaning": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80",
    "airbnb-cleaning": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&auto=format&fit=crop&q=80",
    "ironing-service": "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=800&auto=format&fit=crop&q=80",
    "cleaning-and-ironing": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80",
    "housekeeping": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80",
    "office-cleaning": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80"
  };
  const normalized = serviceId.toLowerCase().trim().replace(/[ _]/g, "-");
  if (fallbacks[normalized]) {
    return fallbacks[normalized];
  }
  if (dbImageUrl && dbImageUrl.trim()) {
    if (dbImageUrl.startsWith("/")) {
      return `${SITE_URL}${dbImageUrl}`;
    }
    return dbImageUrl;
  }
  return "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80";
}

// api/_handlers/config.ts
async function handleConfig(req, res) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return sendError(res, "Backend credentials not configured in environment variables.", 500);
  }
  return sendSuccess(res, {
    apiVersion: "2.2.0",
    siteUrl: SITE_URL,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  });
}

// api/_handlers/services.ts
async function handleServices(req, res) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405);
  }
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from("services").select("*").eq("active", true).order("price", { ascending: true });
    if (error) {
      return sendError(res, error.message, 500);
    }
    const services = (data || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
      price: Number(s.price),
      discount_percent: Number(s.discount_percent || 0),
      popular: Boolean(s.popular),
      active: Boolean(s.active),
      image_url: resolveServiceImageUrl(s.id, s.image_url),
      raw_image_url: s.image_url
    }));
    return sendSuccess(res, services);
  } catch (err) {
    return sendError(res, err?.message || "Failed to fetch services", 500);
  }
}

// api/_handlers/settings.ts
async function handleSettings(req, res) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405);
  }
  try {
    const settingsMap = {
      discount_weekly: "15",
      discount_fortnightly: "10",
      discount_monthly: "5",
      business_phone: "+44 7362 068202",
      contact_email: "contact@makemeclean.co.uk",
      business_hours: "7 days a week, 8am\u20138pm",
      email_info: "info@makemeclean.co.uk",
      email_recruitment: "recruitment@makemeclean.co.uk",
      email_payment: "payment@makemeclean.co.uk",
      email_payroll: "payroll@makemeclean.co.uk",
      loyalty_enabled: "false"
    };
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from("settings").select("key, value");
    if (error) {
      return sendSuccess(res, settingsMap);
    }
    if (data) {
      for (const row of data) {
        settingsMap[row.key] = row.value;
      }
    }
    return sendSuccess(res, settingsMap);
  } catch (err) {
    return sendError(res, err?.message || "Failed to fetch settings", 500);
  }
}

// api/_handlers/service-cities.ts
async function handleServiceCities(req, res) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405);
  }
  const defaultCities = [
    "Cardiff",
    "Swansea",
    "Newport",
    "Barry",
    "Bridgend",
    "Penarth",
    "Caerphilly",
    "Pontypridd",
    "Cwmbran",
    "Llanelli",
    "Neath",
    "Port Talbot",
    "Merthyr Tydfil"
  ];
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from("service_cities").select("*").eq("is_active", true).order("name", { ascending: true });
    if (error) {
      return sendSuccess(res, defaultCities);
    }
    const cities = (data || []).map((c) => c.name);
    return sendSuccess(res, cities.length > 0 ? cities : defaultCities);
  } catch (err) {
    return sendError(res, err?.message || "Failed to fetch service cities", 500);
  }
}

// api/_handlers/booking-options.ts
async function handleBookingOptions(req, res) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405);
  }
  try {
    const supabase = getServerSupabase();
    const [servicesRes, settingsRes, citiesRes] = await Promise.all([
      supabase.from("services").select("*").eq("active", true).order("price", { ascending: true }),
      supabase.from("settings").select("key, value"),
      supabase.from("service_cities").select("name").eq("is_active", true).order("name", { ascending: true })
    ]);
    const services = (servicesRes.data || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
      price: Number(s.price),
      discount_percent: Number(s.discount_percent || 0),
      popular: Boolean(s.popular),
      active: Boolean(s.active),
      image_url: resolveServiceImageUrl(s.id, s.image_url)
    }));
    const discounts = {
      none: 0,
      weekly: 15,
      fortnightly: 10,
      monthly: 5
    };
    if (settingsRes.data) {
      for (const row of settingsRes.data) {
        if (row.key === "discount_weekly") discounts.weekly = Number(row.value) || 15;
        if (row.key === "discount_fortnightly") discounts.fortnightly = Number(row.value) || 10;
        if (row.key === "discount_monthly") discounts.monthly = Number(row.value) || 5;
      }
    }
    const defaultCities = [
      "Cardiff",
      "Swansea",
      "Newport",
      "Barry",
      "Bridgend",
      "Penarth",
      "Caerphilly",
      "Pontypridd",
      "Cwmbran",
      "Llanelli",
      "Neath",
      "Port Talbot",
      "Merthyr Tydfil"
    ];
    const cities = citiesRes.data && citiesRes.data.length > 0 ? citiesRes.data.map((c) => c.name) : defaultCities;
    return sendSuccess(res, {
      services,
      cities,
      discounts,
      startHours: START_HOURS,
      minDurationHours: MIN_DURATION_HOURS,
      maxDurationHours: MAX_DURATION_HOURS,
      durationStepHours: DURATION_STEP_HOURS
    });
  } catch (err) {
    return sendError(res, err?.message || "Failed to fetch booking options", 500);
  }
}

// api/_handlers/dashboard.ts
function isPastDate(date) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return date < today;
}
function isActiveUpcoming(status, date) {
  return ["upcoming", "pending", "confirmed"].includes(status) && !isPastDate(date);
}
async function handleDashboard(req, res) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405);
  }
  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || "Unauthorized", 401);
  }
  try {
    const [profileRes, bookingsRes, servicesRes, notifsRes, settingsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("bookings").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      supabase.from("services").select("*").eq("active", true).order("price", { ascending: true }),
      supabase.from("notifications").select("id, title, message, read, created_at").eq("user_id", user.id).eq("read", false),
      supabase.from("settings").select("value").eq("key", "loyalty_enabled").maybeSingle()
    ]);
    const loyaltyEnabled = settingsRes?.data?.value === "true";
    const bookings = bookingsRes?.data || [];
    const counts = {
      total: bookings.length,
      upcoming: bookings.filter((b) => isActiveUpcoming(b.status, b.date)).length,
      in_progress: bookings.filter((b) => b.status === "in_progress").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length
    };
    const recentBookings = bookings.slice(0, 4).map((b) => ({
      id: b.id,
      service_type: b.service_type,
      service_name: b.service_name,
      date: b.date,
      time_slot: b.time_slot,
      price: Number(b.price),
      status: b.status,
      payment_status: b.payment_status,
      invoice_number: b.invoice_number,
      address: b.address,
      city: b.city,
      postcode: b.postcode,
      created_at: b.created_at
    }));
    const services = (servicesRes.data || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
      price: Number(s.price),
      discount_percent: Number(s.discount_percent || 0),
      popular: Boolean(s.popular),
      active: Boolean(s.active),
      image_url: resolveServiceImageUrl(s.id, s.image_url)
    }));
    const profile = profileRes.data || {
      id: user.id,
      email: user.email,
      full_name: user.email?.split("@")[0] || "Customer",
      loyalty_points: 0
    };
    const points = Number(profile.loyalty_points || 0);
    let tier = "Bronze";
    let discountPercent = 0;
    let nextTierPoints = 100;
    if (points >= 500) {
      tier = "Platinum";
      discountPercent = 20;
      nextTierPoints = 500;
    } else if (points >= 250) {
      tier = "Gold";
      discountPercent = 15;
      nextTierPoints = 500;
    } else if (points >= 100) {
      tier = "Silver";
      discountPercent = 10;
      nextTierPoints = 250;
    }
    return sendSuccess(res, {
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email || user.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        postcode: profile.postcode,
        loyalty_points: points,
        created_at: profile.created_at
      },
      counts,
      recent_bookings: recentBookings,
      services,
      loyalty: {
        enabled: loyaltyEnabled,
        points,
        tier,
        discount_percent: discountPercent,
        next_tier_points: nextTierPoints
      },
      loyalty_enabled: loyaltyEnabled,
      unread_notifications_count: notifsRes.data ? notifsRes.data.length : 0
    });
  } catch (err) {
    return sendError(res, err?.message || "Failed to fetch dashboard data", 500);
  }
}

// api/_handlers/bookings.ts
async function handleBookings(req, res, subPath, params = {}) {
  const method = (req.method || "GET").toUpperCase();
  const auth = await verifyAuth(req);
  if (!auth) {
    return sendError(res, "Authentication required", 401);
  }
  const { supabase, user } = auth;
  const segments = subPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    if (method === "GET") {
      const statusFilter = req.query?.status || "";
      let query = supabase.from("bookings").select("*").eq("user_id", user.id).order("date", { ascending: false });
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "upcoming") {
          query = query.in("status", ["upcoming", "pending", "confirmed"]);
        } else {
          query = query.eq("status", statusFilter);
        }
      }
      const { data, error } = await query;
      if (error) return sendError(res, error.message, 500);
      const items = (data || []).map((b) => ({
        ...b,
        imageUrl: resolveServiceImageUrl(b.service_type, null)
      }));
      return sendSuccess(res, items);
    }
    if (method === "POST") {
      const body = req.body || {};
      const {
        serviceId,
        date,
        timeSlot: rawTimeSlot,
        startHour,
        durationHours: rawDuration,
        address,
        city,
        postcode,
        notes,
        recurringFreq = "none"
      } = body;
      if (!serviceId || !date || !address || !postcode) {
        return sendError(res, "Missing required booking fields (serviceId, date, address, postcode).", 400);
      }
      const { data: service, error: svcErr } = await supabase.from("services").select("id, name, price, discount_percent, active").eq("id", serviceId).eq("active", true).single();
      if (svcErr || !service) {
        return sendError(res, "Selected service is unavailable.", 400);
      }
      let durationHours = typeof rawDuration === "number" ? rawDuration : 2;
      let timeSlot = rawTimeSlot;
      if (!timeSlot && startHour) {
        timeSlot = calcTimeSlot(startHour, durationHours);
      } else if (timeSlot) {
        durationHours = calculateDurationHours(timeSlot);
      } else {
        timeSlot = "09:00 - 11:00";
        durationHours = 2;
      }
      durationHours = Math.max(1.5, Math.min(12, durationHours));
      const baseHourlyRate = Number(service.price) || 20;
      const basePrice = baseHourlyRate * durationHours;
      let discountPercent = Number(service.discount_percent) || 0;
      let recurringDiscountPercent = 0;
      if (recurringFreq && recurringFreq !== "none" && recurringFreq !== "one_off") {
        const { data: settingsData } = await supabase.from("settings").select("key, value").in("key", ["discount_weekly", "discount_biweekly", "discount_monthly"]);
        const settingsMap = {};
        for (const s of settingsData || []) {
          settingsMap[s.key] = Number(s.value) || 0;
        }
        if (recurringFreq === "weekly") recurringDiscountPercent = settingsMap["discount_weekly"] || 15;
        else if (recurringFreq === "biweekly" || recurringFreq === "fortnightly") recurringDiscountPercent = settingsMap["discount_biweekly"] || 10;
        else if (recurringFreq === "monthly") recurringDiscountPercent = settingsMap["discount_monthly"] || 5;
      }
      const totalDiscountPercent = Math.min(50, discountPercent + recurringDiscountPercent);
      const finalPrice = Math.round(basePrice * (1 - totalDiscountPercent / 100) * 100) / 100;
      const invoiceNumber = generateInvoiceNumber();
      try {
        await supabase.from("profiles").upsert({ id: user.id }, { onConflict: "id" });
      } catch (_) {
      }
      const bookingInsert = {
        user_id: user.id,
        service_type: service.id,
        service_name: service.name,
        date,
        time_slot: timeSlot,
        address: address.trim(),
        city: (city || "South Wales").trim(),
        postcode: postcode.trim().toUpperCase(),
        price: finalPrice,
        status: "upcoming",
        payment_status: "pending",
        notes: notes ? String(notes).trim() : null,
        invoice_number: invoiceNumber
      };
      const { data: booking, error: insertErr } = await supabase.from("bookings").insert(bookingInsert).select().single();
      if (insertErr || !booking) {
        console.error("[Booking Insert Error]:", insertErr);
        return sendError(res, insertErr?.message || "Failed to create booking", 500);
      }
      if (recurringFreq && recurringFreq !== "none" && recurringFreq !== "one_off") {
        const normalizedFreq = recurringFreq === "biweekly" ? "fortnightly" : recurringFreq;
        if (["weekly", "fortnightly", "monthly"].includes(normalizedFreq)) {
          const { error: planErr } = await supabase.from("recurring_plans").insert({
            user_id: user.id,
            service_type: service.id,
            service_name: service.name,
            frequency: normalizedFreq,
            start_time: startHour || timeSlot.split(" - ")[0] || "09:00",
            duration_hours: durationHours,
            address: address.trim(),
            city: (city || "South Wales").trim(),
            postcode: postcode.trim().toUpperCase(),
            price_per_visit: finalPrice,
            discount_percent: recurringDiscountPercent,
            status: "active",
            notes: notes ? String(notes).trim() : null
          });
          if (planErr) {
            console.error("[Recurring Plan Insert Warning]:", planErr);
          }
        }
      }
      try {
        const botToken = getEnv("TELEGRAM_BOT_TOKEN");
        const chatId = getEnv("TELEGRAM_ADMIN_CHAT_ID") || getEnv("TELEGRAM_CHAT_ID");
        if (botToken && chatId) {
          const msg = `\u{1F9F9} *New Booking Created*
*ID:* \`${booking.id}\`
*Service:* ${service.name}
*Date:* ${date} (${timeSlot})
*Address:* ${booking.address}, ${booking.postcode}
*Price:* \xA3${finalPrice.toFixed(2)}`;
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" })
          });
        }
      } catch (_) {
      }
      return sendSuccess(res, { booking }, 201);
    }
  }
  const bookingId = segments[0] || params.id;
  if (!bookingId) {
    return sendError(res, "Booking ID is required", 400);
  }
  const action = segments[1] || "";
  if (action === "cancel") {
    if (method !== "POST") return sendError(res, "Method not allowed", 405);
    const { data: booking, error: fetchErr } = await supabase.from("bookings").select("id, user_id, status, date, time_slot").eq("id", bookingId).single();
    if (fetchErr || !booking) return sendError(res, "Booking not found", 404);
    if (booking.user_id !== user.id) return sendError(res, "Unauthorized", 403);
    if (booking.status === "cancelled") return sendError(res, "Booking is already cancelled", 400);
    const { error: updateErr } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
    if (updateErr) return sendError(res, updateErr.message, 500);
    return sendSuccess(res, { message: "Booking cancelled successfully" });
  }
  if (action === "checkout") {
    if (method !== "POST") return sendError(res, "Method not allowed", 405);
    const { data: booking, error: fetchErr } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (fetchErr || !booking) return sendError(res, "Booking not found", 404);
    if (booking.user_id !== user.id) return sendError(res, "Unauthorized", 403);
    const siteUrl = getEnv("SITE_URL", "https://makemeclean.co.uk");
    const successUrl = `${siteUrl}/booking-detail/${booking.id}?payment=success`;
    const cancelUrl = `${siteUrl}/booking-detail/${booking.id}?payment=cancelled`;
    const stripeSecretKey = getEnv("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return sendSuccess(res, {
        checkoutUrl: `${siteUrl}/payment/${booking.id}`,
        mode: "fallback_web"
      });
    }
    try {
      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: user.email || "",
          "client_reference_id": booking.id,
          "metadata[booking_id]": booking.id,
          "metadata[user_id]": user.id,
          "line_items[0][price_data][currency]": "gbp",
          "line_items[0][price_data][unit_amount]": String(Math.round(booking.price * 100)),
          "line_items[0][price_data][product_data][name]": `MakeMeClean - ${booking.service_name}`,
          "line_items[0][price_data][product_data][description]": `Cleaning on ${booking.date} (${booking.time_slot})`,
          "line_items[0][quantity]": "1"
        }).toString()
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok || !session.url) {
        return sendSuccess(res, { checkoutUrl: `${siteUrl}/payment/${booking.id}` });
      }
      return sendSuccess(res, { checkoutUrl: session.url, sessionId: session.id });
    } catch (_) {
      return sendSuccess(res, { checkoutUrl: `${siteUrl}/payment/${booking.id}` });
    }
  }
  if (action === "reschedule") {
    if (method === "GET") {
      const { data, error } = await supabase.from("reschedule_requests").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data);
    }
    if (method === "POST") {
      const { requestedDate, requestedTime, reason } = req.body || {};
      if (!requestedDate || !requestedTime) {
        return sendError(res, "Requested date and time are required", 400);
      }
      const { data, error } = await supabase.from("reschedule_requests").insert({
        booking_id: bookingId,
        user_id: user.id,
        requested_date: requestedDate,
        requested_time: requestedTime,
        reason: reason ? String(reason).trim() : null,
        status: "pending"
      }).select().single();
      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data, 201);
    }
  }
  if (action === "invoice") {
    if (method !== "GET") return sendError(res, "Method not allowed", 405);
    const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (error || !booking) return sendError(res, "Booking not found", 404);
    if (booking.user_id !== user.id) return sendError(res, "Unauthorized", 403);
    const netAmount = Math.round(booking.price / 1.2 * 100) / 100;
    const vatAmount = Math.round((booking.price - netAmount) * 100) / 100;
    return sendSuccess(res, {
      invoiceNumber: booking.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`,
      bookingId: booking.id,
      date: booking.date,
      customerName: user.email?.split("@")[0] || "Valued Customer",
      customerEmail: user.email,
      serviceName: booking.service_name,
      address: booking.address,
      city: booking.city,
      postcode: booking.postcode,
      grossAmount: booking.price,
      netAmount,
      vatAmount,
      currency: "GBP",
      paymentStatus: booking.payment_status,
      company: {
        name: "MakeMeClean Ltd",
        country: "United Kingdom",
        email: "support@makemeclean.co.uk",
        phone: "+44 7700 900077"
      }
    });
  }
  if (action === "photos") {
    if (method === "GET") {
      const { data, error } = await supabase.from("booking_photos").select("*").eq("booking_id", bookingId).order("uploaded_at", { ascending: false });
      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data || []);
    }
    if (method === "POST") {
      const { storagePath, photoType = "after" } = req.body || {};
      if (!storagePath) return sendError(res, "storagePath is required", 400);
      const { data, error } = await supabase.from("booking_photos").insert({
        booking_id: bookingId,
        user_id: user.id,
        storage_path: storagePath,
        photo_type: photoType
      }).select().single();
      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data, 201);
    }
    if (method === "DELETE") {
      const { photoId, storagePath } = req.body || {};
      if (!photoId) return sendError(res, "photoId is required", 400);
      if (storagePath) {
        await supabase.storage.from("booking-photos").remove([storagePath]);
      }
      const { error } = await supabase.from("booking_photos").delete().eq("id", photoId).eq("user_id", user.id);
      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, { message: "Photo deleted" });
    }
  }
  if (action === "refund") {
    if (method !== "POST") return sendError(res, "Method not allowed", 405);
    const { reason, amount } = req.body || {};
    if (!reason) return sendError(res, "Refund reason is required", 400);
    const { data: booking, error: fetchErr } = await supabase.from("bookings").select("id, user_id, price, status").eq("id", bookingId).single();
    if (fetchErr || !booking) return sendError(res, "Booking not found", 404);
    if (booking.user_id !== user.id) return sendError(res, "Unauthorized", 403);
    const refundAmount = typeof amount === "number" ? amount : booking.price;
    const { data, error } = await supabase.from("refund_requests").insert({
      booking_id: bookingId,
      user_id: user.id,
      reason: String(reason).trim(),
      amount: refundAmount,
      status: "pending"
    }).select().single();
    if (error) return sendError(res, error.message, 500);
    return sendSuccess(res, data, 201);
  }
  if (segments.length === 1 && method === "GET") {
    const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
    if (error || !booking) return sendError(res, "Booking not found", 404);
    if (booking.user_id !== user.id) return sendError(res, "Unauthorized", 403);
    let cleaner = null;
    if (booking.staff_id) {
      const { data: staffData } = await supabase.from("staff").select("id, full_name, phone, rating, avatar_url").eq("id", booking.staff_id).maybeSingle();
      cleaner = staffData;
    }
    const { data: reschedule } = await supabase.from("reschedule_requests").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { data: refund } = await supabase.from("refund_requests").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return sendSuccess(res, {
      ...booking,
      imageUrl: resolveServiceImageUrl(booking.service_type, null),
      cleaner,
      rescheduleRequest: reschedule || null,
      refundRequest: refund || null
    });
  }
  return sendError(res, "Endpoint not found", 404);
}

// api/_handlers/plans.ts
async function handlePlans(req, res, subPath, params = {}) {
  const method = (req.method || "GET").toUpperCase();
  const auth = await verifyAuth(req);
  if (!auth) {
    return sendError(res, "Authentication required", 401);
  }
  const { supabase, user } = auth;
  const segments = subPath.split("/").filter(Boolean);
  const planId = segments[0] || params.id;
  if (!planId) {
    if (method === "GET") {
      const { data, error } = await supabase.from("recurring_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data || []);
    }
    return sendError(res, "Method not allowed", 405);
  }
  if (method === "PATCH") {
    const { status } = req.body || {};
    if (!["active", "paused", "cancelled"].includes(status)) {
      return sendError(res, "Invalid plan status (must be active, paused, or cancelled)", 400);
    }
    const { data: plan, error: fetchErr } = await supabase.from("recurring_plans").select("id, user_id").eq("id", planId).single();
    if (fetchErr || !plan) return sendError(res, "Plan not found", 404);
    if (plan.user_id !== user.id) return sendError(res, "Unauthorized", 403);
    const { data: updated, error: updateErr } = await supabase.from("recurring_plans").update({ status }).eq("id", planId).select().single();
    if (updateErr) return sendError(res, updateErr.message, 500);
    return sendSuccess(res, updated);
  }
  return sendError(res, "Method not allowed", 405);
}

// api/_handlers/loyalty.ts
async function handleLoyalty(req, res) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405);
  }
  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || "Unauthorized", 401);
  }
  try {
    const [{ data: profile, error }, { data: settingRow }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, loyalty_points, created_at").eq("id", user.id).single(),
      supabase.from("settings").select("value").eq("key", "loyalty_enabled").maybeSingle()
    ]);
    const isEnabled = settingRow?.value === "true";
    if (error && error.code !== "PGRST116") {
      return sendError(res, error.message, 500);
    }
    const points = Number(profile?.loyalty_points || 0);
    let tier = "Bronze";
    let discountPercent = 0;
    let nextTierPoints = 100;
    let nextTierName = "Silver";
    let progressPercent = points / 100 * 100;
    if (points >= 500) {
      tier = "Platinum";
      discountPercent = 20;
      nextTierPoints = 500;
      nextTierName = "Max Tier";
      progressPercent = 100;
    } else if (points >= 250) {
      tier = "Gold";
      discountPercent = 15;
      nextTierPoints = 500;
      nextTierName = "Platinum";
      progressPercent = Math.min(100, Math.round((points - 250) / 250 * 100));
    } else if (points >= 100) {
      tier = "Silver";
      discountPercent = 10;
      nextTierPoints = 250;
      nextTierName = "Gold";
      progressPercent = Math.min(100, Math.round((points - 100) / 150 * 100));
    }
    return sendSuccess(res, {
      enabled: isEnabled,
      points,
      tier,
      discount_percent: discountPercent,
      next_tier_name: nextTierName,
      next_tier_points: nextTierPoints,
      progress_percent: progressPercent,
      tiers: [
        { name: "Bronze", min_points: 0, discount_percent: 0, perks: "Standard loyalty account" },
        { name: "Silver", min_points: 100, discount_percent: 10, perks: "10% off all cleaning bookings" },
        { name: "Gold", min_points: 250, discount_percent: 15, perks: "15% off + priority slot allocation" },
        { name: "Platinum", min_points: 500, discount_percent: 20, perks: "20% VIP discount + free add-on services" }
      ]
    });
  } catch (err) {
    return sendError(res, err?.message || "Failed to fetch loyalty status", 500);
  }
}

// api/_handlers/contact.ts
async function handleContact(req, res) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405);
  }
  try {
    const body = req.body || {};
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    const subject = (body.subject || "Website Inquiry").trim();
    const message = (body.message || "").trim();
    if (!name || !email || !message) {
      return sendError(res, "Please provide name, email, and message.", 400);
    }
    const supabase = getServerSupabase();
    const { data: inserted, error } = await supabase.from("contact_messages").insert({
      name,
      email,
      phone: phone || null,
      subject,
      message,
      read: false
    }).select().single();
    if (error) {
      return sendError(res, error.message, 500);
    }
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const text = `\u{1F4E9} *New Contact Message*

\u2022 *From:* ${name} (${email})
\u2022 *Phone:* ${phone || "N/A"}
\u2022 *Subject:* ${subject}

"${message}"`;
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "Markdown"
          })
        }).catch(() => {
        });
      } catch (_) {
      }
    }
    return sendSuccess(res, {
      message: "Thank you for reaching out. We have received your inquiry.",
      id: inserted?.id
    }, 201);
  } catch (err) {
    return sendError(res, err?.message || "Failed to submit contact message", 500);
  }
}

// api/_handlers/notifications.ts
async function handleNotifications(req, res) {
  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || "Unauthorized", 401);
  }
  if (req.method === "GET") {
    try {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
      if (error) {
        return sendError(res, error.message, 500);
      }
      return sendSuccess(res, data || []);
    } catch (err) {
      return sendError(res, err?.message || "Failed to fetch notifications", 500);
    }
  }
  if (req.method === "PATCH" || req.method === "POST") {
    try {
      const body = req.body || {};
      const notifId = body.notificationId || body.id;
      if (notifId) {
        await supabase.from("notifications").update({ read: true }).eq("id", notifId).eq("user_id", user.id);
      } else {
        await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
      }
      return sendSuccess(res, { success: true });
    } catch (err) {
      return sendError(res, err?.message || "Failed to update notifications", 500);
    }
  }
  return sendError(res, "Method not allowed", 405);
}

// api/index.ts
async function handler(req, res) {
  if (handleCors(req, res)) return;
  let path = "";
  if (typeof req.query?.path === "string") {
    path = req.query.path;
  } else if (Array.isArray(req.query?.path)) {
    path = req.query.path.join("/");
  } else {
    const rawUrl = req.url || "";
    const cleanUrl = rawUrl.split("?")[0];
    path = cleanUrl.replace(/^\/api(\/|$)/, "").replace(/\/$/, "");
  }
  path = path.replace(/^\/+/, "");
  const segments = path.split("/").filter(Boolean);
  const route = segments[0] || "";
  const subPath = segments.slice(1).join("/");
  try {
    switch (route) {
      case "config":
        return await handleConfig(req, res);
      case "services":
        return await handleServices(req, res);
      case "settings":
        return await handleSettings(req, res);
      case "service-cities":
        return await handleServiceCities(req, res);
      case "booking-options":
        return await handleBookingOptions(req, res);
      case "dashboard":
        return await handleDashboard(req, res);
      case "bookings":
        return await handleBookings(req, res, subPath);
      case "plans":
        return await handlePlans(req, res, subPath);
      case "loyalty":
        return await handleLoyalty(req, res);
      case "contact":
        return await handleContact(req, res);
      case "notifications":
        return await handleNotifications(req, res);
      default:
        return sendError(res, `API route not found: /api/${path}`, 404);
    }
  } catch (err) {
    console.error(`[API Error] /api/${path}:`, err);
    return sendError(res, err?.message || "Internal server error", 500);
  }
}
export {
  handler as default
};
