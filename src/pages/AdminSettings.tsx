import { useEffect, useState } from "react";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  Clock,
  Info,
  Send,
  Bell,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { SETTING_DEFAULTS, invalidateSettingsCache } from "@/hooks/useSettings";

type FormValues = {
  business_phone: string;
  contact_email: string;
  business_hours: string;
  email_info: string;
  email_recruitment: string;
  email_payment: string;
  email_payroll: string;
  email_staffing: string;
};

const FIELDS: {
  key: keyof FormValues;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  type?: string;
}[] = [
  {
    key: "business_phone",
    label: "Business phone",
    sub: "Shown in footer, contact page and homepage call button",
    icon: Phone,
  },
  {
    key: "contact_email",
    label: "Contact email",
    sub: "Shown in footer, contact page and FAQ",
    icon: Mail,
  },
  {
    key: "business_hours",
    label: "Business hours",
    sub: "Shown in footer and contact page",
    icon: Clock,
  },
  {
    key: "email_info",
    label: "Info / general email",
    sub: "Used in customer reply emails (info@...)",
    icon: Mail,
  },
  {
    key: "email_recruitment",
    label: "Recruitment email",
    sub: "Shown on applicant emails and recruitment pages",
    icon: Mail,
  },
  {
    key: "email_payment",
    label: "Payments email",
    sub: "Shown on invoices and payment pages",
    icon: Mail,
  },
  {
    key: "email_payroll",
    label: "Payroll email",
    sub: "Shown on staff payslips",
    icon: Mail,
  },
  {
    key: "email_staffing",
    label: "Staffing email",
    sub: "Used in staff shift assignment emails",
    icon: Mail,
  },
];

const CRON_SCHEDULES = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Every 12 hours", cron: "0 */12 * * *" },
  { label: "Every day at 8 AM", cron: "0 8 * * *" },
  { label: "Every day at 9 AM", cron: "0 9 * * *" },
  { label: "Every day at 10 AM", cron: "0 10 * * *" },
];

function ScheduleDropdown() {
  const [cron, setCron] = useState("0 * * * *");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "reminder_schedule_cron")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setCron(data.value);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      {
        key: "reminder_schedule_cron",
        value: cron,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading)
    return (
      <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    );

  return (
    <div className="flex items-end gap-3 flex-wrap mb-6">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">
          Schedule for sending reminders
        </label>
        <select
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          {CRON_SCHEDULES.map((s) => (
            <option key={s.cron} value={s.cron}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1.5">
          Cron:{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">
            {cron}
          </code>
        </p>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {saved ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
    </div>
  );
}

function ReminderHoursSetting() {
  const [hours, setHours] = useState("24");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "reminder_hours_before")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setHours(data.value);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from("settings").upsert(
      {
        key: "reminder_hours_before",
        value: hours,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading)
    return (
      <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    );

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">
          Send reminder how many hours before booking?
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="168"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-sm text-gray-500 font-medium">
            hours before
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          e.g. 24 = reminder sent 24 hours before the booking time
        </p>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {saved ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "Saving…" : saved ? "Saved!" : "Save"}
      </button>
    </div>
  );
}

function ServiceCitiesManagement() {
  const [cities, setCities] = useState<
    { id: string; name: string; region: string; is_active: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [newCityName, setNewCityName] = useState("");
  const [newCityRegion, setNewCityRegion] = useState("South Wales");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCities = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_cities")
      .select("id, name, region, is_active")
      .order("name", { ascending: true });
    if (data) setCities(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCities();
  }, []);

  const toggleCity = async (id: string, current: boolean) => {
    setTogglingId(id);
    await supabase
      .from("service_cities")
      .update({ is_active: !current })
      .eq("id", id);
    setCities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !current } : c))
    );
    setTogglingId(null);
  };

  const addCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    const { data } = await supabase
      .from("service_cities")
      .insert({
        name: newCityName.trim(),
        region: newCityRegion,
        is_active: true,
      })
      .select()
      .single();
    if (data) {
      setCities((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewCityName("");
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-black text-gray-900">
            Service Locations & Availability
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Click any city to open or pause service coverage in real-time
          </p>
        </div>
        <span className="text-xs font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
          {cities.filter((c) => c.is_active).length} Active Locations
        </span>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {cities.map((city) => (
                <div
                  key={city.id}
                  onClick={() => toggleCity(city.id, city.is_active)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-2 ${
                    city.is_active
                      ? "bg-green-50/60 border-green-200 hover:border-green-300"
                      : "bg-gray-50 border-gray-200 opacity-60 hover:opacity-80"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {city.name}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {city.region}
                    </p>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black transition-colors shrink-0 ${
                      city.is_active
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {city.is_active ? "✓" : "✕"}
                  </span>
                </div>
              ))}
            </div>

            {/* Add Location form */}
            <form
              onSubmit={addCity}
              className="flex gap-2 pt-3 border-t border-gray-100 flex-wrap sm:flex-nowrap"
            >
              <input
                type="text"
                placeholder="New City / Town name..."
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
              <select
                value={newCityRegion}
                onChange={(e) => setNewCityRegion(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
              >
                <option value="South Wales">South Wales</option>
                <option value="Mid Wales">Mid Wales</option>
                <option value="North Wales">North Wales</option>
                <option value="West Wales">West Wales</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
              >
                + Add City
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function LoyaltyProgramToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "loyalty_enabled")
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(data?.value === "true");
        setLoading(false);
      });
  }, []);

  const toggle = async () => {
    const nextVal = !enabled;
    setSaving(true);
    setEnabled(nextVal);
    await supabase.from("settings").upsert(
      {
        key: "loyalty_enabled",
        value: nextVal ? "true" : "false",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    invalidateSettingsCache();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900">
              Customer Loyalty & Rewards Program
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Control whether the Loyalty Rewards system is visible to customers
              across web and mobile
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full border ${
            enabled
              ? "text-green-700 bg-green-50 border-green-200"
              : "text-gray-500 bg-gray-50 border-gray-200"
          }`}
        >
          {enabled ? "Active & Visible" : "Hidden / Disabled"}
        </span>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="py-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-900">
                {enabled
                  ? "Loyalty Rewards is currently ACTIVE"
                  : "Loyalty Rewards is currently HIDDEN"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {enabled
                  ? "Customers can see their points, tiers, and redeem rewards on both the web portal and mobile app."
                  : "Loyalty links, badges, and points are completely hidden from customer navigation until you turn it on."}
              </p>
            </div>
            <button
              type="button"
              onClick={toggle}
              disabled={saving}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-2 ${
                enabled
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {saving ? (
                "Saving..."
              ) : saved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Saved!
                </>
              ) : enabled ? (
                "Turn Off Loyalty"
              ) : (
                "Turn On Loyalty"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [values, setValues] = useState<FormValues>({
    ...SETTING_DEFAULTS,
  } as FormValues);
  const [original, setOriginal] = useState<FormValues>({
    ...SETTING_DEFAULTS,
  } as FormValues);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [newsletterBody, setNewsletterBody] = useState("");
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterError, setNewsletterError] = useState("");

  useEffect(() => {
    if (loading || roleLoading || !isAdmin) return;
    supabase
      .from("settings")
      .select("key, value")
      .then(({ data }) => {
        const map: Record<string, string> = { ...SETTING_DEFAULTS };
        for (const row of data ?? []) map[row.key] = row.value;
        const v = map as FormValues;
        setValues(v);
        setOriginal(v);
        setFetching(false);
      });
  }, [loading, roleLoading, isAdmin]);

  const isDirty = JSON.stringify(values) !== JSON.stringify(original);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    const rows = (Object.keys(values) as (keyof FormValues)[]).map((key) => ({
      key,
      value: values[key].trim() || SETTING_DEFAULTS[key],
      updated_at: new Date().toISOString(),
    }));
    const { error: err } = await supabase
      .from("settings")
      .upsert(rows, { onConflict: "key" });
    if (err) {
      setError(err.message);
    } else {
      invalidateSettingsCache();
      setOriginal({ ...values });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    }
    setSaving(false);
  };

  const sendNewsletter = async () => {
    if (!newsletterSubject.trim() || !newsletterBody.trim()) {
      setNewsletterError("Subject and body are required");
      return;
    }

    setSendingNewsletter(true);
    setNewsletterError("");
    setNewsletterSuccess(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-newsletter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            subject: newsletterSubject.trim(),
            bodyText: newsletterBody.trim(),
          }),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Failed to send newsletter");
      }

      setNewsletterSuccess(true);
      setNewsletterSubject("");
      setNewsletterBody("");
      setTimeout(() => setNewsletterSuccess(false), 5000);
    } catch (e: any) {
      setNewsletterError(e.message ?? "Error sending newsletter");
    } finally {
      setSendingNewsletter(false);
    }
  };

  if (loading || roleLoading) return null;
  if (!isAdmin)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Access denied
      </div>
    );

  const sections = [
    {
      title: "Customer-facing contact info",
      subtitle:
        "Shown to customers on the website — footer, contact page, and homepage.",
      keys: [
        "business_phone",
        "contact_email",
        "business_hours",
      ] as (keyof FormValues)[],
    },
    {
      title: "Department email addresses",
      subtitle:
        "Shown on invoices, payslips, and recruitment pages. To change the actual sending address for automated emails, update your Brevo sender settings.",
      keys: [
        "email_info",
        "email_recruitment",
        "email_payment",
        "email_payroll",
        "email_staffing",
      ] as (keyof FormValues)[],
    },
  ];

  return (
    <AdminLayout
      title="Site Settings"
      subtitle="Manage contact info and email addresses shown across the site"
      actions={
        <button
          onClick={save}
          disabled={saving || !isDirty || fetching}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      }
    >
      {fetching ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {success && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">
                Settings saved. Changes are live on the website immediately.
              </p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-sm font-black text-gray-900">
                  {section.title}
                </h2>
                <p className="text-xs text-gray-400 mt-1">{section.subtitle}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {section.keys.map((key) => {
                  const field = FIELDS.find((f) => f.key === key)!;
                  const Icon = field.icon;
                  const changed = values[key] !== original[key];
                  return (
                    <div key={key} className="px-6 py-4 flex items-start gap-4">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-1">
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-xs font-bold text-gray-700">
                            {field.label}
                          </label>
                          {changed && (
                            <span className="text-[10px] font-bold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                              unsaved
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mb-2">
                          {field.sub}
                        </p>
                        <input
                          type="text"
                          value={values[key]}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [key]: e.target.value }))
                          }
                          placeholder={SETTING_DEFAULTS[key]}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-blue-700 mb-1">
                Automated email senders
              </p>
              <p className="text-xs text-blue-600 leading-relaxed">
                The email addresses above control what is <em>displayed</em> on
                the website. The actual sending address for automated emails
                (booking confirmations, staff assignments, etc.) is controlled
                by your Brevo account. To change the sender, update it there.
              </p>
            </div>
          </div>

          {/* Customer Loyalty Toggle */}
          <LoyaltyProgramToggle />

          {/* Service Cities Management */}
          <ServiceCitiesManagement />

          {/* Booking Reminders Section */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">
                Booking Reminders
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Automatic email reminders sent to customers before their booking
              </p>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
                <Bell className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-blue-700 mb-1">
                    How to set up automatic reminders
                  </p>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    To enable automatic reminders, schedule the{" "}
                    <code className="bg-blue-100 px-1 py-0.5 rounded">
                      send-booking-reminders
                    </code>{" "}
                    Edge Function in your Supabase dashboard under{" "}
                    <strong>Edge Functions → Schedules</strong>. Choose a
                    schedule below, and the function will automatically read the
                    hours setting.
                  </p>
                </div>
              </div>
              <ScheduleDropdown />
              <ReminderHoursSetting />
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">Newsletter</h2>
              <p className="text-xs text-gray-400 mt-1">
                Send email to all newsletter subscribers
              </p>
            </div>
            <div className="p-6 space-y-4">
              {newsletterSuccess && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm font-semibold text-green-800">
                    Newsletter sent successfully!
                  </p>
                </div>
              )}
              {newsletterError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{newsletterError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={newsletterSubject}
                  onChange={(e) => setNewsletterSubject(e.target.value)}
                  placeholder="e.g. Spring Cleaning Tips"
                  disabled={sendingNewsletter}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={newsletterBody}
                  onChange={(e) => setNewsletterBody(e.target.value)}
                  placeholder="Write your newsletter message..."
                  disabled={sendingNewsletter}
                  rows={6}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50"
                />
              </div>

              <button
                onClick={sendNewsletter}
                disabled={
                  sendingNewsletter ||
                  !newsletterSubject.trim() ||
                  !newsletterBody.trim()
                }
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-bold rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {sendingNewsletter ? "Sending..." : "Send Newsletter"}
              </button>
            </div>
          </div>

          <div className="flex justify-end pb-4">
            <button
              onClick={save}
              disabled={saving || !isDirty}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
