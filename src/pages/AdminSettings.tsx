import { useEffect, useState } from "react";
import { Save, CheckCircle2, AlertCircle, Phone, Mail, Clock, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { SETTING_DEFAULTS, invalidateSettingsCache } from "@/hooks/useSettings";

type FormValues = {
  business_phone:    string;
  contact_email:     string;
  business_hours:    string;
  email_info:        string;
  email_recruitment: string;
  email_payment:     string;
  email_payroll:     string;
  email_staffing:    string;
};

const FIELDS: { key: keyof FormValues; label: string; sub: string; icon: React.ComponentType<{className?: string}>; type?: string }[] = [
  { key: "business_phone",    label: "Business phone",      sub: "Shown in footer, contact page and homepage call button", icon: Phone },
  { key: "contact_email",     label: "Contact email",       sub: "Shown in footer, contact page and FAQ",                  icon: Mail  },
  { key: "business_hours",    label: "Business hours",      sub: "Shown in footer and contact page",                       icon: Clock },
  { key: "email_info",        label: "Info / general email",sub: "Used in customer reply emails (info@...)",               icon: Mail  },
  { key: "email_recruitment", label: "Recruitment email",   sub: "Shown on applicant emails and recruitment pages",        icon: Mail  },
  { key: "email_payment",     label: "Payments email",      sub: "Shown on invoices and payment pages",                    icon: Mail  },
  { key: "email_payroll",     label: "Payroll email",       sub: "Shown on staff payslips",                                icon: Mail  },
  { key: "email_staffing",    label: "Staffing email",      sub: "Used in staff shift assignment emails",                  icon: Mail  },
];

export default function AdminSettings() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [values, setValues]     = useState<FormValues>({ ...SETTING_DEFAULTS } as FormValues);
  const [original, setOriginal] = useState<FormValues>({ ...SETTING_DEFAULTS } as FormValues);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (loading || roleLoading || !isAdmin) return;
    supabase.from("settings").select("key, value").then(({ data }) => {
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
    const { error: err } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
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

  if (loading || roleLoading) return null;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">Access denied</div>;

  const sections = [
    {
      title: "Customer-facing contact info",
      subtitle: "Shown to customers on the website — footer, contact page, and homepage.",
      keys: ["business_phone", "contact_email", "business_hours"] as (keyof FormValues)[],
    },
    {
      title: "Department email addresses",
      subtitle: "Shown on invoices, payslips, and recruitment pages. To change the actual sending address for automated emails, update your Brevo sender settings.",
      keys: ["email_info", "email_recruitment", "email_payment", "email_payroll", "email_staffing"] as (keyof FormValues)[],
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
              <p className="text-sm font-semibold text-green-800">Settings saved. Changes are live on the website immediately.</p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.title} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-sm font-black text-gray-900">{section.title}</h2>
                <p className="text-xs text-gray-400 mt-1">{section.subtitle}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {section.keys.map((key) => {
                  const field = FIELDS.find((f) => f.key === key)!;
                  const Icon  = field.icon;
                  const changed = values[key] !== original[key];
                  return (
                    <div key={key} className="px-6 py-4 flex items-start gap-4">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-1">
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-xs font-bold text-gray-700">{field.label}</label>
                          {changed && <span className="text-[10px] font-bold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">unsaved</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 mb-2">{field.sub}</p>
                        <input
                          type="text"
                          value={values[key]}
                          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
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
              <p className="text-xs font-bold text-blue-700 mb-1">Automated email senders</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                The email addresses above control what is <em>displayed</em> on the website.
                The actual sending address for automated emails (booking confirmations, staff assignments, etc.)
                is controlled by your Brevo account. To change the sender, update it there.
              </p>
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
