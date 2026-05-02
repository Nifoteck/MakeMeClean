import { useState, useRef, useEffect } from "react";
import { CheckCircle, Upload, X, MapPin, Clock, PoundSterling, Heart, Users, Leaf, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sendOtp, verifyOtp } from "@/lib/otp";

const ROLES = [
  "Domestic Cleaner",
  "Commercial Cleaner",
  "Deep Clean Specialist",
  "End of Tenancy Cleaner",
  "Airbnb / Holiday Let Cleaner",
  "Window Cleaner",
  "Ironing & Laundry Specialist",
  "Other",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EXPERIENCE_TYPES = [
  "Domestic / residential",
  "Commercial / office",
  "Deep cleaning",
  "End of tenancy",
  "Airbnb / short-let",
  "Window cleaning",
  "Ironing / laundry",
];

const RTW_TYPES = [
  "British / Irish Passport",
  "UK Birth Certificate + NI proof",
  "EU Settlement Scheme",
  "Biometric Residence Permit",
  "Work Visa",
  "Other",
];

interface FileEntry {
  label: string;
  key: string;
  required: boolean;
  accept: string;
}

const FILE_FIELDS: FileEntry[] = [
  { label: "CV / Resume *", key: "cv", required: true, accept: ".pdf,.doc,.docx" },
  { label: "Proof of Identity *", key: "id_proof", required: true, accept: ".pdf,.jpg,.jpeg,.png" },
  { label: "Right to Work Document *", key: "rtw_doc", required: true, accept: ".pdf,.jpg,.jpeg,.png" },
  { label: "DBS Certificate (optional)", key: "dbs_cert", required: false, accept: ".pdf,.jpg,.jpeg,.png" },
];

const DRAFT_KEY = (email: string) => `careers-draft-${email.toLowerCase()}`;

type Step = 1 | 2 | 3;
type EmailStage = "entry" | "verify" | "verified";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
        active ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

const defaultForm = {
  role: "",
  employment_type: "",
  available_days: [] as string[],
  earliest_start: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postcode: "",
  rtw_eligible: "",
  rtw_type: "",
  ni_number: "",
  years_experience: "",
  experience_types: [] as string[],
  own_equipment: "",
  driving_licence: "",
  declare_accurate: false,
  declare_privacy: false,
};

export default function Careers() {
  const [step, setStep] = useState<Step>(1);
  const [emailStage, setEmailStage] = useState<EmailStage>("entry");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({ cv: null, id_proof: null, rtw_doc: null, dbs_cert: null });

  const [form, setForm] = useState(defaultForm);

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const set = (key: string, value: unknown) =>
    setForm((f) => {
      const updated = { ...f, [key]: value };
      if (emailStage === "verified" && updated.email) {
        saveDraft(updated);
      }
      return updated;
    });

  const toggle = (key: "available_days" | "experience_types", val: string) =>
    setForm((f) => {
      const arr = f[key] as string[];
      const updated = { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
      if (emailStage === "verified") saveDraft(updated);
      return updated;
    });

  const saveDraft = (data: typeof form) => {
    if (!data.email) return;
    try {
      localStorage.setItem(DRAFT_KEY(data.email), JSON.stringify({ form: data, step }));
    } catch {}
  };

  const loadDraft = (email: string) => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(email));
      if (!raw) return null;
      return JSON.parse(raw) as { form: typeof form; step: Step };
    } catch {
      return null;
    }
  };

  const clearDraft = (email: string) => {
    try { localStorage.removeItem(DRAFT_KEY(email)); } catch {}
  };

  useEffect(() => {
    if (form.email && emailStage === "entry") {
      const draft = loadDraft(form.email);
      setHasDraft(!!draft);
    }
  }, [form.email, emailStage]);

  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!form.email || !form.email.includes("@")) { setError("Please enter a valid email address."); return; }
    setSendingOtp(true);
    setError("");
    const result = await sendOtp(form.email, "careers");
    if (!result.ok) { setError(result.error ?? "Failed to send code"); setSendingOtp(false); return; }
    setEmailStage("verify");
    setOtp(["", "", "", "", "", ""]);
    startCooldown();
    setSendingOtp(false);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!digit && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (next.every((d) => d !== "")) verifyCode(next.join(""));
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (digits.length === 6) { setOtp(digits.split("")); verifyCode(digits); }
  };

  const verifyCode = async (code: string) => {
    setVerifying(true);
    setError("");
    const result = await verifyOtp(form.email, code, "careers");
    if (!result.ok || !result.verified) {
      const msg =
        result.reason === "expired_or_not_found"
          ? "Code expired. Please request a new one."
          : "Incorrect code. Try again.";
      setError(msg);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
      setVerifying(false);
      return;
    }
    setEmailStage("verified");
    setVerifying(false);
    setError("");

    const draft = loadDraft(form.email);
    if (draft) {
      setForm(draft.form);
      setStep(draft.step);
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setError("");
    const result = await sendOtp(form.email, "careers");
    if (!result.ok) setError(result.error ?? "Failed to resend");
    else startCooldown();
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const goToStep = (next: Step) => {
    setStep(next);
    if (emailStage === "verified") saveDraft(form);
  };

  const handleSubmit = async () => {
    if (!form.declare_accurate || !form.declare_privacy) {
      setError("Please accept the declarations to submit.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const uploadedUrls: Record<string, string> = {};
      for (const field of FILE_FIELDS) {
        const file = files[field.key];
        if (!file) continue;
        const path = `applications/${Date.now()}_${field.key}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadErr } = await supabase.storage.from("applications").upload(path, file);
        if (!uploadErr) {
          const { data } = supabase.storage.from("applications").getPublicUrl(path);
          uploadedUrls[field.key] = data.publicUrl;
        }
      }

      const { error: insertErr } = await supabase.from("job_applications").insert({
        role: form.role,
        employment_type: form.employment_type || null,
        available_days: form.available_days,
        earliest_start: form.earliest_start || null,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        address: form.address || null,
        city: form.city || null,
        postcode: form.postcode || null,
        rtw_eligible: form.rtw_eligible,
        rtw_type: form.rtw_type || null,
        ni_number: form.ni_number || null,
        years_experience: form.years_experience || null,
        experience_types: form.experience_types,
        own_equipment: form.own_equipment || null,
        driving_licence: form.driving_licence || null,
        cv_url: uploadedUrls.cv || null,
        id_proof_url: uploadedUrls.id_proof || null,
        rtw_doc_url: uploadedUrls.rtw_doc || null,
        dbs_cert_url: uploadedUrls.dbs_cert || null,
        status: "pending",
      });

      if (insertErr) throw new Error(insertErr.message);
      clearDraft(form.email);
      setSubmitted(true);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Application received!</h1>
          <p className="text-gray-500 mb-6">
            Thanks for applying. We'll review your application and get back to you within <strong>3–5 working days</strong>.
          </p>
          <button onClick={() => (window.location.href = "/")} className="btn-primary px-8">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="green-gradient py-12 px-4 text-center text-white">
        <h1 className="text-3xl md:text-4xl font-black mb-3">Join MakeMeClean</h1>
        <p className="text-green-100 max-w-lg mx-auto">
          Flexible hours, competitive pay, and a team that looks after its people.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm text-green-100">
          {[
            { icon: PoundSterling, text: "Competitive pay" },
            { icon: Clock, text: "Flexible hours" },
            { icon: MapPin, text: "Work locally" },
            { icon: Heart, text: "Great culture" },
            { icon: Leaf, text: "Eco products" },
            { icon: Users, text: "Full training" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5">
              <Icon className="w-4 h-4 text-green-300" /> {text}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Step indicator — only show when past email verification */}
        {emailStage === "verified" && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {[["1", "Position & Contact"], ["2", "Experience"], ["3", "Documents"]].map(([n, label], i) => (
              <div key={n} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 text-sm font-medium ${parseInt(n) <= step ? "text-green-700" : "text-gray-400"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    parseInt(n) < step ? "bg-green-600 border-green-600 text-white"
                    : parseInt(n) === step ? "border-green-600 text-green-700"
                    : "border-gray-200 text-gray-400"
                  }`}>
                    {parseInt(n) < step ? "✓" : n}
                  </div>
                  <span className="hidden sm:block">{label}</span>
                </div>
                {i < 2 && <div className={`w-8 h-px ${parseInt(n) < step ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Email entry ── */}
        {emailStage === "entry" && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Start your application</h2>
              <p className="text-sm text-gray-500">
                Enter your email to begin. We'll send a code to verify it — your progress is saved automatically so you can return anytime.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <label className="label">Email address *</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              />
              {hasDraft && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mt-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  We found a saved draft for this email. Verify your email to continue where you left off.
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!form.email || sendingOtp}
              onClick={handleSendOtp}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingOtp ? "Sending code..." : "Send verification code"}
            </button>
          </div>
        )}

        {/* ── OTP verification ── */}
        {emailStage === "verify" && (
          <div className="card space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a 6-digit code to <strong>{form.email}</strong>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 text-center mb-4 uppercase tracking-wide">Enter verification code</p>
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    disabled={verifying}
                    className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all disabled:opacity-50 bg-white"
                  />
                ))}
              </div>
              {verifying && (
                <p className="text-center text-xs text-gray-400 mt-3">Verifying...</p>
              )}
            </div>

            <div className="text-center space-y-2">
              <button
                onClick={resendCode}
                disabled={resendCooldown > 0}
                className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
              <br />
              <button
                onClick={() => { setEmailStage("entry"); setError(""); setOtp(["", "", "", "", "", ""]); }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Position & Contact ── */}
        {emailStage === "verified" && step === 1 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Position & Contact</h2>
              <p className="text-sm text-gray-500">Tell us the role you want and how to reach you.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <label className="label">Role applying for *</label>
              <select className="input-field" value={form.role} onChange={(e) => set("role", e.target.value)} required>
                <option value="">Select a role</option>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Employment type</label>
              <div className="flex flex-wrap gap-2">
                {["Part-time", "Full-time", "Flexible / Zero Hours", "Weekends Only"].map((t) => (
                  <Chip key={t} active={form.employment_type === t} onClick={() => set("employment_type", t)}>{t}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Days available</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <Chip key={d} active={form.available_days.includes(d)} onClick={() => toggle("available_days", d)}>{d}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Earliest start date</label>
              <input type="date" className="input-field" value={form.earliest_start} onChange={(e) => set("earliest_start", e.target.value)} />
            </div>

            <hr className="border-gray-100" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First name *</label>
                <input className="input-field" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
              </div>
              <div>
                <label className="label">Last name *</label>
                <input className="input-field" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
              </div>
            </div>

            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{form.email}</p>
                <p className="text-xs text-green-600">Email verified</p>
              </div>
            </div>

            <div>
              <label className="label">Phone *</label>
              <input type="tel" className="input-field" placeholder="+44 7000 000000" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input-field" placeholder="Street, City, Postcode" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>

            <button
              type="button"
              disabled={!form.role || !form.first_name || !form.last_name || !form.phone}
              onClick={() => goToStep(2)}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: Experience & RTW ── */}
        {emailStage === "verified" && step === 2 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Experience & Eligibility</h2>
              <p className="text-sm text-gray-500">Tell us about your background and right to work.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div>
              <label className="label">Years of cleaning experience</label>
              <select className="input-field" value={form.years_experience} onChange={(e) => set("years_experience", e.target.value)}>
                <option value="">Select</option>
                {["Less than 1 year", "1–2 years", "3–5 years", "6–10 years", "10+ years"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Types of experience</label>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_TYPES.map((t) => (
                  <Chip key={t} active={form.experience_types.includes(t)} onClick={() => toggle("experience_types", t)}>{t}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Own cleaning equipment?</label>
              <div className="flex gap-2">
                {["Yes", "No", "Some"].map((v) => (
                  <Chip key={v} active={form.own_equipment === v.toLowerCase()} onClick={() => set("own_equipment", v.toLowerCase())}>{v}</Chip>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Full UK driving licence?</label>
              <div className="flex gap-2">
                <Chip active={form.driving_licence === "yes"} onClick={() => set("driving_licence", "yes")}>Yes</Chip>
                <Chip active={form.driving_licence === "no"} onClick={() => set("driving_licence", "no")}>No</Chip>
              </div>
            </div>

            <hr className="border-gray-100" />

            <div>
              <label className="label">Legally entitled to work in the UK? *</label>
              <div className="flex gap-2">
                <Chip active={form.rtw_eligible === "yes"} onClick={() => set("rtw_eligible", "yes")}>Yes</Chip>
                <Chip active={form.rtw_eligible === "no"} onClick={() => set("rtw_eligible", "no")}>No</Chip>
              </div>
              {form.rtw_eligible === "no" && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  We can only employ individuals legally entitled to work in the UK.
                </p>
              )}
            </div>

            {form.rtw_eligible === "yes" && (
              <div>
                <label className="label">Right to work document type</label>
                <select className="input-field" value={form.rtw_type} onChange={(e) => set("rtw_type", e.target.value)}>
                  <option value="">Select</option>
                  {RTW_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}

            {form.rtw_eligible === "yes" && (
              <div>
                <label className="label">National Insurance number (if you have one)</label>
                <input className="input-field font-mono tracking-widest" placeholder="AB 12 34 56 C" value={form.ni_number} onChange={(e) => set("ni_number", e.target.value.toUpperCase())} />
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => goToStep(1)} className="btn-secondary">Back</button>
              <button
                type="button"
                disabled={!form.rtw_eligible || form.rtw_eligible === "no"}
                onClick={() => goToStep(3)}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Documents & Submit ── */}
        {emailStage === "verified" && step === 3 && (
          <div className="card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Documents & Declaration</h2>
              <p className="text-sm text-gray-500">Upload your documents and confirm the declaration.</p>
            </div>

            {FILE_FIELDS.map((field) => {
              const file = files[field.key];
              return (
                <div key={field.key}>
                  <label className="label">{field.label}</label>
                  <input
                    type="file"
                    accept={field.accept}
                    ref={(el) => { fileRefs.current[field.key] = el; }}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setFiles((prev) => ({ ...prev, [field.key]: f }));
                    }}
                  />
                  {file ? (
                    <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-xl px-3 py-2.5">
                      <span className="text-sm text-green-800 font-medium truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles((p) => ({ ...p, [field.key]: null }));
                          if (fileRefs.current[field.key]) fileRefs.current[field.key]!.value = "";
                        }}
                        className="ml-2 text-green-600 hover:text-red-500 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRefs.current[field.key]?.click()}
                      className="w-full border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-green-400 hover:text-green-700 transition-colors flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" /> Choose file
                    </button>
                  )}
                </div>
              );
            })}

            <hr className="border-gray-100" />

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.declare_accurate}
                  onChange={(e) => set("declare_accurate", e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-600">
                  I confirm the information I have provided is accurate and complete.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.declare_privacy}
                  onChange={(e) => set("declare_privacy", e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-600">
                  I consent to MakeMeClean storing and processing my data for recruitment purposes.
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => goToStep(2)} className="btn-secondary">Back</button>
              <button
                type="button"
                disabled={submitting || !files.cv || !files.id_proof || !files.rtw_doc || !form.declare_accurate || !form.declare_privacy}
                onClick={handleSubmit}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
