import { useState, useRef } from "react";
import {
  Briefcase, CheckCircle, Upload, AlertCircle, ChevronDown, ChevronUp,
  MapPin, Clock, PoundSterling, Heart, Users, Leaf, X, FileText
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

const EMPLOYMENT_TYPES = ["Part-time", "Full-time", "Flexible / Zero Hours", "Weekends Only"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EXPERIENCE_TYPES = [
  "Domestic / residential cleaning",
  "Commercial / office cleaning",
  "Deep cleaning",
  "End of tenancy cleaning",
  "Airbnb / short-let cleaning",
  "Window cleaning",
  "Carpet / upholstery cleaning",
  "Ironing / laundry",
];
const RIGHT_TO_WORK_TYPES = [
  "British / Irish Passport",
  "UK Birth or Adoption Certificate + NI proof",
  "EU Settlement Scheme (Settled or Pre-Settled Status)",
  "Biometric Residence Permit (BRP)",
  "Work Visa / Permission to work",
  "Other",
];

interface FileEntry {
  label: string;
  key: string;
  required: boolean;
  accept: string;
  hint: string;
}

const FILE_FIELDS: FileEntry[] = [
  { label: "CV / Resume", key: "cv", required: true, accept: ".pdf,.doc,.docx", hint: "PDF or Word document, max 5MB" },
  { label: "Proof of Identity", key: "id_proof", required: true, accept: ".pdf,.jpg,.jpeg,.png", hint: "Passport or UK driving licence, max 5MB" },
  { label: "Right to Work Document", key: "rtw_doc", required: true, accept: ".pdf,.jpg,.jpeg,.png", hint: "Matches your selection above, max 5MB" },
  { label: "DBS Certificate (if held)", key: "dbs_cert", required: false, accept: ".pdf,.jpg,.jpeg,.png", hint: "Optional — upload if you already have one" },
];

type FormStep = "role" | "personal" | "work" | "experience" | "history" | "references" | "documents" | "declaration";

const STEPS: { key: FormStep; label: string }[] = [
  { key: "role", label: "Position" },
  { key: "personal", label: "Personal" },
  { key: "work", label: "Right to Work" },
  { key: "experience", label: "Experience" },
  { key: "history", label: "Work History" },
  { key: "references", label: "References" },
  { key: "documents", label: "Documents" },
  { key: "declaration", label: "Declaration" },
];

export default function Careers() {
  const [currentStep, setCurrentStep] = useState<FormStep>("role");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Files
  const [files, setFiles] = useState<Record<string, File | null>>({ cv: null, id_proof: null, rtw_doc: null, dbs_cert: null });
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Form data
  const [form, setForm] = useState({
    // Role
    role: "",
    employment_type: "",
    available_days: [] as string[],
    available_hours: "",
    earliest_start: "",
    heard_from: "",

    // Personal
    first_name: "",
    last_name: "",
    dob: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postcode: "",

    // Right to work
    rtw_eligible: "",
    rtw_type: "",
    ni_number: "",
    ni_available: "",

    // Experience
    years_experience: "",
    experience_types: [] as string[],
    own_equipment: "",
    driving_licence: "",
    specialist_skills: "",

    // Employment history
    emp1_company: "",
    emp1_role: "",
    emp1_start: "",
    emp1_end: "",
    emp1_leaving: "",
    emp1_contact: "",
    emp2_company: "",
    emp2_role: "",
    emp2_start: "",
    emp2_end: "",
    emp2_leaving: "",
    emp2_contact: "",

    // References
    ref1_name: "",
    ref1_company: "",
    ref1_title: "",
    ref1_relationship: "",
    ref1_phone: "",
    ref1_email: "",
    ref2_name: "",
    ref2_company: "",
    ref2_title: "",
    ref2_relationship: "",
    ref2_phone: "",
    ref2_email: "",

    // Emergency contact
    emergency_name: "",
    emergency_relationship: "",
    emergency_phone: "",

    // Declaration
    declare_accurate: false,
    declare_dbs: false,
    declare_privacy: false,
  });

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const toggleArray = (key: "available_days" | "experience_types", val: string) => {
    setForm((f) => {
      const arr = f[key] as string[];
      return { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });
  };

  const stepIdx = STEPS.findIndex((s) => s.key === currentStep);
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === STEPS.length - 1;

  const next = () => {
    if (!isLast) setCurrentStep(STEPS[stepIdx + 1].key);
  };
  const back = () => {
    if (!isFirst) setCurrentStep(STEPS[stepIdx - 1].key);
  };

  const handleFileChange = (key: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      // Upload files to Supabase Storage
      const uploadedUrls: Record<string, string> = {};
      for (const field of FILE_FIELDS) {
        const file = files[field.key];
        if (!file) continue;
        const path = `applications/${Date.now()}_${field.key}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadErr } = await supabase.storage.from("applications").upload(path, file);
        if (uploadErr) {
          // Silently continue if storage not set up — store without file URLs
          console.warn("Upload skipped:", uploadErr.message);
          uploadedUrls[field.key] = `[Upload failed: ${uploadErr.message}]`;
        } else {
          const { data } = supabase.storage.from("applications").getPublicUrl(path);
          uploadedUrls[field.key] = data.publicUrl;
        }
      }

      // Insert application record
      const { error: insertErr } = await supabase.from("job_applications").insert({
        role: form.role,
        employment_type: form.employment_type,
        available_days: form.available_days,
        available_hours: form.available_hours,
        earliest_start: form.earliest_start || null,
        heard_from: form.heard_from,
        first_name: form.first_name,
        last_name: form.last_name,
        dob: form.dob || null,
        gender: form.gender || null,
        email: form.email,
        phone: form.phone,
        address: form.address,
        city: form.city,
        postcode: form.postcode,
        rtw_eligible: form.rtw_eligible,
        rtw_type: form.rtw_type,
        ni_number: form.ni_number || null,
        years_experience: form.years_experience,
        experience_types: form.experience_types,
        own_equipment: form.own_equipment,
        driving_licence: form.driving_licence,
        specialist_skills: form.specialist_skills || null,
        emp1_company: form.emp1_company || null,
        emp1_role: form.emp1_role || null,
        emp1_start: form.emp1_start || null,
        emp1_end: form.emp1_end || null,
        emp1_leaving: form.emp1_leaving || null,
        emp1_contact: form.emp1_contact || null,
        emp2_company: form.emp2_company || null,
        emp2_role: form.emp2_role || null,
        emp2_start: form.emp2_start || null,
        emp2_end: form.emp2_end || null,
        emp2_leaving: form.emp2_leaving || null,
        emp2_contact: form.emp2_contact || null,
        ref1_name: form.ref1_name,
        ref1_company: form.ref1_company || null,
        ref1_title: form.ref1_title || null,
        ref1_relationship: form.ref1_relationship,
        ref1_phone: form.ref1_phone,
        ref1_email: form.ref1_email || null,
        ref2_name: form.ref2_name || null,
        ref2_company: form.ref2_company || null,
        ref2_title: form.ref2_title || null,
        ref2_relationship: form.ref2_relationship || null,
        ref2_phone: form.ref2_phone || null,
        ref2_email: form.ref2_email || null,
        emergency_name: form.emergency_name,
        emergency_relationship: form.emergency_relationship,
        emergency_phone: form.emergency_phone,
        cv_url: uploadedUrls.cv || null,
        id_proof_url: uploadedUrls.id_proof || null,
        rtw_doc_url: uploadedUrls.rtw_doc || null,
        dbs_cert_url: uploadedUrls.dbs_cert || null,
        status: "pending",
      });

      if (insertErr) throw new Error(insertErr.message);
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
        <div className="max-w-lg w-full text-center animate-fade-in">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">Application received!</h1>
          <p className="text-gray-500 text-lg leading-relaxed mb-8">
            Thanks for applying to join MakeMeClean. We'll review your application and get back to you within <strong>3–5 working days</strong>.
          </p>
          <div className="card text-left space-y-3 mb-8">
            <p className="text-sm font-semibold text-gray-700">What happens next?</p>
            {[
              "We review your application and documents",
              "If shortlisted, we'll call you for a brief phone interview",
              "Successful candidates are invited to meet the team",
              "DBS check completed before your first assignment",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm text-gray-500">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-700 text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                {s}
              </div>
            ))}
          </div>
          <button onClick={() => window.location.href = "/"} className="btn-primary px-8 py-3">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero banner */}
      <div className="green-gradient py-14 px-4">
        <div className="max-w-3xl mx-auto text-center text-white">
          <p className="text-green-300 text-xs font-semibold uppercase tracking-widest mb-3">We're hiring across Wales</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">Join the MakeMeClean team</h1>
          <p className="text-green-100 text-lg leading-relaxed max-w-xl mx-auto">
            Flexible hours, competitive pay, and a team that genuinely looks after its people. Sound good? Apply below.
          </p>
          <div className="flex flex-wrap justify-center gap-5 mt-8 text-sm text-green-100">
            {[
              { icon: PoundSterling, text: "Competitive hourly pay" },
              { icon: Clock, text: "Flexible working hours" },
              { icon: MapPin, text: "Work near where you live" },
              { icon: Heart, text: "Supportive team culture" },
              { icon: Leaf, text: "Eco-friendly products provided" },
              { icon: Users, text: "Full training & support" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon className="w-4 h-4 text-green-300" /> {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Step progress */}
        <div className="flex items-center mb-10 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center shrink-0">
              <button
                onClick={() => i < stepIdx && setCurrentStep(s.key)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-semibold transition-colors",
                  s.key === currentStep ? "text-green-700" :
                  i < stepIdx ? "text-green-600 cursor-pointer hover:text-green-800" :
                  "text-gray-300 cursor-default"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                  s.key === currentStep ? "border-green-600 bg-green-600 text-white" :
                  i < stepIdx ? "border-green-500 bg-green-500 text-white" :
                  "border-gray-200 text-gray-400"
                )}>
                  {i < stepIdx ? "✓" : i + 1}
                </div>
                <span className="hidden sm:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn("w-6 sm:w-10 h-px mx-1", i < stepIdx ? "bg-green-400" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>

        {/* Form sections */}
        <div className="card animate-fade-in">
          {/* ── STEP: Role ─────────────────── */}
          {currentStep === "role" && (
            <Section title="Position & Availability" desc="Tell us what role you're applying for and when you're able to work.">
              <Field label="Role applying for *">
                <select className="input-field" value={form.role} onChange={(e) => set("role", e.target.value)} required>
                  <option value="">Select a role</option>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Type of employment *">
                <div className="grid grid-cols-2 gap-2">
                  {EMPLOYMENT_TYPES.map((t) => (
                    <ToggleBtn key={t} active={form.employment_type === t} onClick={() => set("employment_type", t)}>{t}</ToggleBtn>
                  ))}
                </div>
              </Field>
              <Field label="Days available to work *" hint="Select all that apply">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <ToggleBtn key={d} active={form.available_days.includes(d)} onClick={() => toggleArray("available_days", d)} small>{d}</ToggleBtn>
                  ))}
                </div>
              </Field>
              <Field label="Preferred hours per week">
                <input className="input-field" placeholder="e.g. 16–24 hours" value={form.available_hours} onChange={(e) => set("available_hours", e.target.value)} />
              </Field>
              <Field label="Earliest available start date">
                <input type="date" className="input-field" value={form.earliest_start} onChange={(e) => set("earliest_start", e.target.value)} />
              </Field>
              <Field label="How did you hear about us?">
                <input className="input-field" placeholder="e.g. Indeed, Google, word of mouth" value={form.heard_from} onChange={(e) => set("heard_from", e.target.value)} />
              </Field>
            </Section>
          )}

          {/* ── STEP: Personal ─────────────── */}
          {currentStep === "personal" && (
            <Section title="Personal Details" desc="Your basic contact information. This stays confidential.">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name *">
                  <input className="input-field" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
                </Field>
                <Field label="Last name *">
                  <input className="input-field" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date of birth *">
                  <input type="date" className="input-field" value={form.dob} onChange={(e) => set("dob", e.target.value)} required />
                </Field>
                <Field label="Gender (optional)">
                  <select className="input-field" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                    <option>Other</option>
                  </select>
                </Field>
              </div>
              <Field label="Email address *">
                <input type="email" className="input-field" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </Field>
              <Field label="Phone number *">
                <input type="tel" className="input-field" placeholder="+44 7000 000000" value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
              </Field>
              <Field label="Home address *">
                <input className="input-field" placeholder="Street address" value={form.address} onChange={(e) => set("address", e.target.value)} required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City">
                  <input className="input-field" value={form.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="Postcode">
                  <input className="input-field" placeholder="CF10 1AB" value={form.postcode} onChange={(e) => set("postcode", e.target.value.toUpperCase())} />
                </Field>
              </div>
              <hr className="border-gray-100 my-2" />
              <p className="text-sm font-semibold text-gray-700" style={{ fontFamily: "Outfit, sans-serif" }}>Emergency Contact</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full name *">
                  <input className="input-field" value={form.emergency_name} onChange={(e) => set("emergency_name", e.target.value)} required />
                </Field>
                <Field label="Relationship *">
                  <input className="input-field" placeholder="e.g. Partner, Parent" value={form.emergency_relationship} onChange={(e) => set("emergency_relationship", e.target.value)} required />
                </Field>
              </div>
              <Field label="Emergency phone *">
                <input type="tel" className="input-field" value={form.emergency_phone} onChange={(e) => set("emergency_phone", e.target.value)} required />
              </Field>
            </Section>
          )}

          {/* ── STEP: Right to work ────────── */}
          {currentStep === "work" && (
            <Section title="Right to Work in the UK" desc="We are legally required to check that all employees are permitted to work in the United Kingdom.">
              <Field label="Are you legally entitled to work in the UK? *">
                <div className="flex gap-3">
                  <ToggleBtn active={form.rtw_eligible === "yes"} onClick={() => set("rtw_eligible", "yes")}>Yes</ToggleBtn>
                  <ToggleBtn active={form.rtw_eligible === "no"} onClick={() => set("rtw_eligible", "no")}>No</ToggleBtn>
                </div>
              </Field>
              {form.rtw_eligible === "yes" && (
                <Field label="What document proves your right to work? *">
                  <select className="input-field" value={form.rtw_type} onChange={(e) => set("rtw_type", e.target.value)}>
                    <option value="">Select document type</option>
                    {RIGHT_TO_WORK_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              )}
              {form.rtw_eligible === "no" && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-sm text-red-700">
                  We are only able to employ individuals who are legally entitled to work in the United Kingdom. If your circumstances change, please do apply again.
                </div>
              )}
              <hr className="border-gray-100 my-2" />
              <p className="text-sm font-semibold text-gray-700" style={{ fontFamily: "Outfit, sans-serif" }}>National Insurance</p>
              <Field label="Do you have a National Insurance number? *">
                <div className="flex gap-3">
                  <ToggleBtn active={form.ni_available === "yes"} onClick={() => set("ni_available", "yes")}>Yes</ToggleBtn>
                  <ToggleBtn active={form.ni_available === "no"} onClick={() => set("ni_available", "no")}>No / Not yet</ToggleBtn>
                </div>
              </Field>
              {form.ni_available === "yes" && (
                <Field label="National Insurance number *">
                  <input className="input-field font-mono tracking-widest" placeholder="AB 12 34 56 C" value={form.ni_number} onChange={(e) => set("ni_number", e.target.value.toUpperCase())} />
                </Field>
              )}
            </Section>
          )}

          {/* ── STEP: Experience ───────────── */}
          {currentStep === "experience" && (
            <Section title="Cleaning Experience & Skills" desc="Tell us about your background so we can find you the right assignments.">
              <Field label="Years of cleaning experience *">
                <select className="input-field" value={form.years_experience} onChange={(e) => set("years_experience", e.target.value)}>
                  <option value="">Select</option>
                  <option>Less than 1 year</option>
                  <option>1–2 years</option>
                  <option>3–5 years</option>
                  <option>6–10 years</option>
                  <option>10+ years</option>
                </select>
              </Field>
              <Field label="Types of cleaning experience *" hint="Select all that apply">
                <div className="grid grid-cols-2 gap-2">
                  {EXPERIENCE_TYPES.map((t) => (
                    <ToggleBtn key={t} active={form.experience_types.includes(t)} onClick={() => toggleArray("experience_types", t)} small>{t}</ToggleBtn>
                  ))}
                </div>
              </Field>
              <Field label="Do you have your own cleaning equipment? *">
                <div className="flex gap-3">
                  <ToggleBtn active={form.own_equipment === "yes"} onClick={() => set("own_equipment", "yes")}>Yes</ToggleBtn>
                  <ToggleBtn active={form.own_equipment === "no"} onClick={() => set("own_equipment", "no")}>No</ToggleBtn>
                  <ToggleBtn active={form.own_equipment === "some"} onClick={() => set("own_equipment", "some")}>Some</ToggleBtn>
                </div>
              </Field>
              <Field label="Do you hold a full UK driving licence? *">
                <div className="flex gap-3">
                  <ToggleBtn active={form.driving_licence === "yes"} onClick={() => set("driving_licence", "yes")}>Yes</ToggleBtn>
                  <ToggleBtn active={form.driving_licence === "no"} onClick={() => set("driving_licence", "no")}>No</ToggleBtn>
                </div>
              </Field>
              <Field label="Any additional qualifications or specialist skills?" hint="Optional">
                <textarea className="input-field resize-none" rows={3} placeholder="e.g. COSHH training, carpet cleaning certification, first aid..." value={form.specialist_skills} onChange={(e) => set("specialist_skills", e.target.value)} />
              </Field>
            </Section>
          )}

          {/* ── STEP: Work history ─────────── */}
          {currentStep === "history" && (
            <Section title="Employment History" desc="List your two most recent employers. Leave blank if not applicable.">
              <EmpBlock n={1} prefix="emp1" form={form} set={set} />
              <hr className="border-gray-100 my-6" />
              <EmpBlock n={2} prefix="emp2" form={form} set={set} />
            </Section>
          )}

          {/* ── STEP: References ───────────── */}
          {currentStep === "references" && (
            <Section title="References" desc="Please provide two professional references who are not family members. We will only contact them if you receive an offer.">
              <RefBlock n={1} prefix="ref1" form={form} set={set} required />
              <hr className="border-gray-100 my-6" />
              <RefBlock n={2} prefix="ref2" form={form} set={set} required={false} />
            </Section>
          )}

          {/* ── STEP: Documents ────────────── */}
          {currentStep === "documents" && (
            <Section title="Document Uploads" desc="Please upload the required documents. All files are stored securely and only used for your application.">
              <div className="space-y-4">
                {FILE_FIELDS.map((f) => (
                  <div key={f.key} className={cn(
                    "border-2 border-dashed rounded-xl p-4 transition-colors",
                    files[f.key] ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-green-300"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {f.label} {f.required && <span className="text-red-500">*</span>}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>
                          {files[f.key] && (
                            <p className="text-xs text-green-700 font-medium mt-1 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> {files[f.key]!.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center shrink-0">
                        {files[f.key] && (
                          <button onClick={() => handleFileChange(f.key, null)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => fileRefs.current[f.key]?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" /> {files[f.key] ? "Change" : "Upload"}
                        </button>
                      </div>
                    </div>
                    <input
                      ref={(el) => { fileRefs.current[f.key] = el; }}
                      type="file"
                      accept={f.accept}
                      className="hidden"
                      onChange={(e) => handleFileChange(f.key, e.target.files?.[0] ?? null)}
                    />
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex gap-2 mt-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>If you are unable to upload documents now, you can bring physical copies to your interview. Mark these as "to bring in person" in the specialist skills box.</span>
              </div>
            </Section>
          )}

          {/* ── STEP: Declaration ──────────── */}
          {currentStep === "declaration" && (
            <Section title="Declaration & Consent" desc="Please read and confirm the following before submitting your application.">
              {[
                {
                  key: "declare_accurate",
                  text: "I confirm that all the information I have provided in this application is accurate and complete to the best of my knowledge. I understand that providing false or misleading information may result in my application being rejected or, if discovered after employment commences, could lead to dismissal.",
                },
                {
                  key: "declare_dbs",
                  text: "I consent to MakeMeClean conducting an Enhanced DBS (Disclosure and Barring Service) check as a condition of employment. I understand this is a legal requirement for this role and will be carried out prior to my first assignment.",
                },
                {
                  key: "declare_privacy",
                  text: "I agree that my personal data and documents will be stored and processed securely by MakeMeClean for the purpose of this recruitment process, in accordance with the UK General Data Protection Regulation (UK GDPR). Data will not be shared with third parties without my consent.",
                },
              ].map(({ key, text }) => (
                <label key={key} className={cn(
                  "flex gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                  (form as Record<string, unknown>)[key] ? "border-green-300 bg-green-50" : "border-gray-100 hover:border-gray-200"
                )}>
                  <input
                    type="checkbox"
                    checked={(form as Record<string, unknown>)[key] as boolean}
                    onChange={(e) => set(key, e.target.checked)}
                    className="mt-0.5 shrink-0 accent-green-600"
                  />
                  <span className="text-sm text-gray-600 leading-relaxed">{text}</span>
                </label>
              ))}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </Section>
          )}

          {/* Nav buttons */}
          <div className={cn("flex gap-3 mt-8 pt-6 border-t border-gray-50", isFirst ? "justify-end" : "justify-between")}>
            {!isFirst && (
              <button onClick={back} className="btn-secondary px-6 py-2.5 text-sm">
                Back
              </button>
            )}
            {!isLast ? (
              <button onClick={next} className="btn-primary px-6 py-2.5 text-sm">
                Continue <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.declare_accurate || !form.declare_dbs || !form.declare_privacy}
                className="btn-primary px-8 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-black text-gray-900 mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h2>
      <p className="text-sm text-gray-500 mb-7">{desc}</p>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}{hint && <span className="text-gray-400 font-normal ml-1">— {hint}</span>}</label>
      {children}
    </div>
  );
}

function ToggleBtn({ children, active, onClick, small }: { children: React.ReactNode; active: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 font-medium transition-all duration-150 text-left",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        active
          ? "border-green-500 bg-green-50 text-green-700"
          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
      )}
    >
      {children}
    </button>
  );
}

function EmpBlock({ n, prefix, form, set }: { n: number; prefix: string; form: Record<string, unknown>; set: (k: string, v: unknown) => void }) {
  const [open, setOpen] = useState(n === 1);
  const f = (key: string) => form[`${prefix}_${key}`] as string ?? "";
  const s = (key: string) => (val: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set(`${prefix}_${key}`, val.target.value);

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 mb-4">
        <span style={{ fontFamily: "Outfit, sans-serif" }}>
          {n === 1 ? "Most Recent Employer" : "Previous Employer"} {n === 2 && <span className="text-gray-400 font-normal">(optional)</span>}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company / Employer name">
              <input className="input-field" value={f("company")} onChange={s("company")} placeholder="Company Ltd" />
            </Field>
            <Field label="Your job title / role">
              <input className="input-field" value={f("role")} onChange={s("role")} placeholder="Cleaner" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <input type="month" className="input-field" value={f("start")} onChange={s("start")} />
            </Field>
            <Field label="End date">
              <input type="month" className="input-field" value={f("end")} onChange={s("end")} placeholder="Leave blank if current" />
            </Field>
          </div>
          <Field label="Reason for leaving">
            <input className="input-field" value={f("leaving")} onChange={s("leaving")} placeholder="e.g. Seeking new opportunities" />
          </Field>
          <Field label="May we contact this employer?">
            <div className="flex gap-3">
              {["Yes", "No", "After offer only"].map((v) => (
                <ToggleBtn key={v} active={f("contact") === v} onClick={() => set(`${prefix}_contact`, v)} small>{v}</ToggleBtn>
              ))}
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

function RefBlock({ n, prefix, form, set, required }: { n: number; prefix: string; form: Record<string, unknown>; set: (k: string, v: unknown) => void; required: boolean }) {
  const f = (key: string) => form[`${prefix}_${key}`] as string ?? "";
  const s = (key: string) => (val: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    set(`${prefix}_${key}`, val.target.value);

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
        Reference {n} {required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
      </p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name">
            <input className="input-field" value={f("name")} onChange={s("name")} required={required} />
          </Field>
          <Field label="Job title">
            <input className="input-field" value={f("title")} onChange={s("title")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company / Organisation">
            <input className="input-field" value={f("company")} onChange={s("company")} />
          </Field>
          <Field label="Your relationship">
            <input className="input-field" placeholder="e.g. Line Manager" value={f("relationship")} onChange={s("relationship")} required={required} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone number">
            <input type="tel" className="input-field" value={f("phone")} onChange={s("phone")} required={required} />
          </Field>
          <Field label="Email address">
            <input type="email" className="input-field" value={f("email")} onChange={s("email")} />
          </Field>
        </div>
      </div>
    </div>
  );
}
