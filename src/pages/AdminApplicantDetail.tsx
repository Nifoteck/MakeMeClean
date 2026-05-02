import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase, ShieldCheck, Wrench, Car, FileText, X, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";

type ApplicationStatus = "pending" | "reviewing" | "shortlisted" | "rejected" | "hired";

interface JobApplication {
  id: string;
  role: string;
  employment_type: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  postcode: string | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  created_at: string;
  available_days: string[] | null;
  earliest_start: string | null;
  rtw_eligible: string | null;
  rtw_type: string | null;
  ni_number: string | null;
  years_experience: string | null;
  experience_types: string[] | null;
  own_equipment: string | null;
  driving_licence: string | null;
  cv_url?: string | null;
  id_proof_url?: string | null;
  rtw_doc_url?: string | null;
  dbs_cert_url?: string | null;
  date_of_birth?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  heard_about_us?: string | null;
  own_transport?: string | null;
  has_convictions?: string | null;
  convictions_details?: string | null;
  ref1_name?: string | null;
  ref1_company?: string | null;
  ref1_phone?: string | null;
  ref1_email?: string | null;
  ref2_name?: string | null;
  ref2_company?: string | null;
  ref2_phone?: string | null;
  ref2_email?: string | null;
  notice_period?: string | null;
  current_employer?: string | null;
  current_job_title?: string | null;
  reason_for_leaving?: string | null;
  health_declaration?: string | null;
  health_details?: string | null;
  equal_opps_gender?: string | null;
  equal_opps_age?: string | null;
  equal_opps_ethnicity?: string | null;
  equal_opps_disability?: string | null;
  equal_opps_sexual_orientation?: string | null;
  equal_opps_religion?: string | null;
  has_staff_relationship?: string | null;
  staff_relationship_details?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  reviewing: "bg-blue-100 text-blue-700",
  shortlisted: "bg-purple-100 text-purple-700",
  hired: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
      {children}
    </p>
  );
}

function Field({ label, value, mono, href, className }: { label: string; value?: string | null; mono?: boolean; href?: string; className?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {href ? (
        <a href={href} className={cn("text-sm font-medium text-green-700 hover:underline break-all", className)}>{value}</a>
      ) : (
        <p className={cn("text-sm font-medium text-gray-900", mono && "font-mono tracking-widest", className)}>{value}</p>
      )}
    </div>
  );
}

export default function AdminApplicantDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [applicant, setApplicant] = useState<JobApplication | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | null>(null);
  const [notes, setNotes] = useState("");

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin || !id) return;
    (async () => {
      const { data, error: err } = await supabase
        .from("job_applications")
        .select("*")
        .eq("id", id)
        .single();
      if (err || !data) { setError("Applicant not found."); setFetching(false); return; }
      setApplicant(data as JobApplication);
      setSelectedStatus((data as JobApplication).status);
      setNotes((data as JobApplication).admin_notes ?? "");
      setFetching(false);
    })();
  }, [isAdmin, id]);

  const openEmailModal = () => {
    setEmailSubject("");
    setEmailBody("");
    setEmailError("");
    setEmailSent(false);
    setEmailOpen(true);
    setTimeout(() => subjectRef.current?.focus(), 80);
  };

  const closeEmailModal = () => {
    if (emailSending) return;
    setEmailOpen(false);
  };

  const sendEmail = async () => {
    if (!applicant || !emailSubject.trim() || !emailBody.trim()) {
      setEmailError("Please fill in both the subject and message.");
      return;
    }
    setEmailSending(true);
    setEmailError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: fnErr } = await supabase.functions.invoke("send-recruitment-email", {
        body: {
          to: applicant.email,
          toName: `${applicant.first_name} ${applicant.last_name}`,
          subject: emailSubject.trim(),
          bodyText: emailBody.trim(),
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (fnErr || !data?.ok) throw new Error(fnErr?.message ?? data?.error ?? "Failed to send");
      setEmailSent(true);
    } catch (e) {
      setEmailError((e as Error).message ?? "Something went wrong. Please try again.");
    } finally {
      setEmailSending(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!applicant || !selectedStatus) return;
    setSaving(true);
    setError("");
    const status = selectedStatus;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (status === "hired") {
        // hire-applicant: creates auth user, staff row, sends portal login email, marks hired
        const { error: hireErr } = await supabase.functions.invoke("hire-applicant", {
          body: { applicationId: applicant.id },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (hireErr) { setError(hireErr.message); setSaving(false); return; }

      } else if (status === "rejected") {
        const { error: err } = await supabase.from("job_applications").update({ status }).eq("id", applicant.id);
        if (err) { setError(err.message); setSaving(false); return; }

        const fullName = `${applicant.first_name} ${applicant.last_name}`;
        const subject = `Your Application – ${applicant.role} | MakeMeClean`;
        const bodyText = `Thank you for taking the time to apply for the position of ${applicant.role} at MakeMeClean, and for your interest in joining our team.

After careful consideration, we regret to inform you that on this occasion your application has not been successful. We received a high volume of applications, and competition for this role was strong.

We would like to encourage you to keep an eye on our future vacancies, as we are always looking for dedicated and motivated individuals to join us.

We appreciate the effort you invested in your application and wish you every success in your future career endeavours.

Should you have any questions, please feel free to contact us at aadeeniiyii@gmail.com.

Kind regards,
MakeMeClean Recruitment Team
Wales, UK`;

        try {
          await supabase.functions.invoke("send-recruitment-email", {
            body: { to: applicant.email, toName: fullName, subject, bodyText },
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          });
        } catch {
          // Email failure is non-fatal — status already saved
        }

      } else {
        const { error: err } = await supabase.from("job_applications").update({ status }).eq("id", applicant.id);
        if (err) { setError(err.message); setSaving(false); return; }
      }

      setApplicant((a) => a ? { ...a, status } : a);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Unexpected error");
    }

    setSaving(false);
  };

  const saveNotes = async () => {
    if (!applicant) return;
    await supabase.from("job_applications").update({ admin_notes: notes }).eq("id", applicant.id);
  };

  if (loading || roleLoading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user || !isAdmin) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">No access.</p></div>;
  if (error && !applicant) return (
    <AdminLayout title="Applicant" subtitle="Not found">
      <div className="card text-center py-16 text-gray-400">{error}</div>
    </AdminLayout>
  );
  if (!applicant) return null;

  return (
    <AdminLayout
      title="Applicant Profile"
      subtitle="Full application details"
      actions={
        <button
          onClick={() => setLocation("/admin/applicants")}
          className="btn-secondary flex items-center gap-1.5 text-sm py-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to list
        </button>
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      {/* ── Email compose modal ── */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEmailModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="text-base font-extrabold text-gray-900">Email applicant</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  From: <span className="font-medium text-gray-600">recruitment@makemeclean.co.uk</span>
                  <span className="mx-2 text-gray-200">·</span>
                  To: <span className="font-medium text-gray-600">{applicant.first_name} {applicant.last_name} &lt;{applicant.email}&gt;</span>
                </p>
              </div>
              <button
                onClick={closeEmailModal}
                disabled={emailSending}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailSent ? (
              <div className="px-6 py-12 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">Email sent!</p>
                <p className="text-sm text-gray-500 mb-6">
                  Your message has been sent to {applicant.first_name}.
                </p>
                <button onClick={closeEmailModal} className="btn-primary px-8">
                  Close
                </button>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {emailError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                    {emailError}
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Subject</label>
                  <input
                    ref={subjectRef}
                    type="text"
                    className="input-field text-sm"
                    placeholder="e.g. Your application for Domestic Cleaner"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    disabled={emailSending}
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Message</label>
                  <textarea
                    className="input-field resize-none text-sm"
                    rows={8}
                    placeholder={`Hi ${applicant.first_name},\n\nThank you for applying to MakeMeClean...`}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    disabled={emailSending}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Your message will be wrapped in a branded email template. The applicant can reply directly to recruitment@makemeclean.co.uk.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1 pb-1">
                  <button
                    onClick={closeEmailModal}
                    disabled={emailSending}
                    className="btn-secondary text-sm py-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                    className="btn-primary flex items-center gap-2 text-sm py-2 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {emailSending ? "Sending..." : "Send email"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Top identity bar ── */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <span className="text-xl font-extrabold text-green-700">
                {applicant.first_name[0]}{applicant.last_name[0]}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 leading-tight">
                {applicant.first_name} {applicant.last_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-sm text-gray-600 font-medium">{applicant.role}</span>
                {applicant.employment_type && (
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">{applicant.employment_type}</span>
                )}
                <span className={cn("px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wide", STATUS_STYLES[applicant.status])}>
                  {applicant.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Applied {new Date(applicant.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          <button
            onClick={openEmailModal}
            className="btn-primary flex items-center gap-1.5 text-sm py-2"
          >
            <Mail className="w-4 h-4" /> Email applicant
          </button>
        </div>
      </div>

      {/* ── Main content grid ── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* 1. Contact & Personal details */}
          <div className="card">
            <SectionHeading>Contact & personal details</SectionHeading>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Email</p>
                  <button onClick={openEmailModal} className="text-sm font-medium text-green-700 hover:underline break-all text-left">{applicant.email}</button>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <a href={`tel:${applicant.phone}`} className="text-sm font-medium text-gray-900 hover:text-green-700">{applicant.phone}</a>
                </div>
              </div>
              {(applicant.address || applicant.city || applicant.postcode) && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Address</p>
                    <p className="text-sm font-medium text-gray-900">
                      {[applicant.address, applicant.city, applicant.postcode?.toUpperCase()].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
              )}
              {applicant.date_of_birth && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Date of birth</p>
                    <p className="text-sm font-medium text-gray-900">{applicant.date_of_birth}</p>
                  </div>
                </div>
              )}
              {(applicant.emergency_contact_name || applicant.emergency_contact_phone) && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Emergency contact</p>
                    <p className="text-sm font-medium text-gray-900">
                      {[applicant.emergency_contact_name, applicant.emergency_contact_phone].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              )}
              {applicant.heard_about_us && (
                <div className="flex items-start gap-3">
                  <Briefcase className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">How they heard about us</p>
                    <p className="text-sm font-medium text-gray-900">{applicant.heard_about_us}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Right to Work & Compliance */}
          <div className="card">
            <SectionHeading>Right to work & compliance</SectionHeading>
            <div className="space-y-3">
              {applicant.rtw_eligible && (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">RTW eligible</p>
                    <p className={cn("text-sm font-semibold", applicant.rtw_eligible === "yes" ? "text-green-700" : "text-red-600")}>
                      {applicant.rtw_eligible === "yes" ? "✓ Yes" : "✗ No"}
                    </p>
                  </div>
                </div>
              )}
              {applicant.rtw_type && (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">RTW document type</p>
                    <p className="text-sm font-medium text-gray-900">{applicant.rtw_type}</p>
                  </div>
                </div>
              )}
              {applicant.ni_number && (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">National Insurance number</p>
                    <p className="text-sm font-mono font-semibold tracking-widest text-gray-900">{applicant.ni_number.toUpperCase()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Uploaded Documents */}
          <div className="card">
            <SectionHeading>Uploaded documents</SectionHeading>
            <div className="space-y-2">
              {([
                ["CV / Resume", applicant.cv_url],
                ["Proof of Identity", applicant.id_proof_url],
                ["Right to Work", applicant.rtw_doc_url],
                ["DBS Certificate", applicant.dbs_cert_url],
              ] as const).map(([label, url]) => (
                <a
                  key={label}
                  href={url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors",
                    url
                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      : "border-gray-100 bg-gray-50 text-gray-300 pointer-events-none"
                  )}
                >
                  <FileText className={cn("w-4 h-4 shrink-0", url ? "text-green-500" : "text-gray-200")} />
                  <span className="flex-1">{label}</span>
                  {url
                    ? <span className="text-xs text-green-500 font-semibold">View ↗</span>
                    : <span className="text-xs font-normal text-gray-300">Not uploaded</span>
                  }
                </a>
              ))}
            </div>
          </div>

          {/* Internal notes */}
          <div className="card">
            <SectionHeading>Internal notes</SectionHeading>
            <textarea
              className="input-field resize-none text-sm w-full"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Add internal notes about this applicant — saved automatically when you click away."
            />
            <p className="text-xs text-gray-400 mt-1.5">Saved automatically on blur. Visible to admins only.</p>
          </div>

        </div>

        {/* ── RIGHT COLUMNS ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* 4. Role & Availability */}
          <div className="card">
            <SectionHeading>Role & availability</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <Field label="Role applied for" value={applicant.role} />
              {applicant.employment_type && <Field label="Employment type" value={applicant.employment_type} />}
              {applicant.earliest_start && <Field label="Earliest start date" value={applicant.earliest_start} />}
              {applicant.notice_period && <Field label="Notice period" value={applicant.notice_period} />}
            </div>
            {applicant.available_days && applicant.available_days.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Available days</p>
                <div className="flex gap-2 flex-wrap">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <span
                      key={d}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold border",
                        applicant.available_days?.includes(d)
                          ? "bg-green-600 text-white border-green-600 shadow-sm"
                          : "bg-gray-50 text-gray-300 border-gray-100"
                      )}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. Experience & Skills */}
          <div className="card">
            <SectionHeading>Experience & skills</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <Field label="Years of experience" value={applicant.years_experience} />
              {applicant.own_equipment && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Own equipment</p>
                  <p className={cn("text-sm font-semibold flex items-center gap-1", applicant.own_equipment === "yes" ? "text-green-700" : "text-gray-600")}>
                    <Wrench className="w-3.5 h-3.5" />
                    {applicant.own_equipment === "yes" ? "Yes" : applicant.own_equipment === "no" ? "No" : applicant.own_equipment}
                  </p>
                </div>
              )}
              {applicant.driving_licence && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Driving licence</p>
                  <p className={cn("text-sm font-semibold flex items-center gap-1", applicant.driving_licence === "yes" ? "text-green-700" : "text-gray-600")}>
                    <Car className="w-3.5 h-3.5" />
                    {applicant.driving_licence === "yes" ? "Yes" : applicant.driving_licence === "no" ? "No" : applicant.driving_licence}
                  </p>
                </div>
              )}
              {applicant.own_transport && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Own transport</p>
                  <p className={cn("text-sm font-semibold flex items-center gap-1", applicant.own_transport === "yes" ? "text-green-700" : "text-gray-600")}>
                    <Car className="w-3.5 h-3.5" />
                    {applicant.own_transport === "yes" ? "Yes" : applicant.own_transport === "no" ? "No" : applicant.own_transport}
                  </p>
                </div>
              )}
            </div>
            {applicant.experience_types && applicant.experience_types.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Experience areas</p>
                <div className="flex flex-wrap gap-2">
                  {applicant.experience_types.map((t) => (
                    <span key={t} className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1.5">
                      <Briefcase className="w-3 h-3" />{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. Employment History */}
          {(applicant.current_employer || applicant.notice_period || applicant.current_job_title) && (
            <div className="card">
              <SectionHeading>Employment history</SectionHeading>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Most recent employer" value={applicant.current_employer} />
                <Field label="Job title" value={applicant.current_job_title} />
                <Field label="Reason for leaving" value={applicant.reason_for_leaving} />
              </div>
            </div>
          )}

          {/* 7. References */}
          {(applicant.ref1_name || applicant.ref2_name) && (
            <div className="card">
              <SectionHeading>References</SectionHeading>
              <div className="grid sm:grid-cols-2 gap-6">
                {applicant.ref1_name && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Reference 1</p>
                    <Field label="Name" value={applicant.ref1_name} />
                    <Field label="Company" value={applicant.ref1_company} />
                    <Field label="Phone" value={applicant.ref1_phone} />
                    <Field label="Email" value={applicant.ref1_email} href={applicant.ref1_email ? `mailto:${applicant.ref1_email}` : undefined} />
                  </div>
                )}
                {applicant.ref2_name && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Reference 2</p>
                    <Field label="Name" value={applicant.ref2_name} />
                    <Field label="Company" value={applicant.ref2_company} />
                    <Field label="Phone" value={applicant.ref2_phone} />
                    <Field label="Email" value={applicant.ref2_email} href={applicant.ref2_email ? `mailto:${applicant.ref2_email}` : undefined} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. Declarations — criminal record, health, staff relationship grouped */}
          <div className="card">
            <SectionHeading>Declarations</SectionHeading>
            <div className="space-y-5">

              {/* Criminal record */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Criminal convictions (DBS)</p>
                <p className={cn("text-sm font-semibold", applicant.has_convictions === "yes" ? "text-amber-600" : "text-green-700")}>
                  {applicant.has_convictions === "yes" ? "Yes — disclosed" : applicant.has_convictions === "no" ? "None declared" : "Not answered"}
                </p>
                {applicant.convictions_details && (
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{applicant.convictions_details}</p>
                )}
              </div>

              {/* Health */}
              {applicant.health_declaration && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Health declaration</p>
                  <p className={cn("text-sm font-semibold", applicant.health_declaration === "yes" ? "text-amber-600" : "text-green-700")}>
                    {applicant.health_declaration === "yes" ? "Yes — disclosed" : applicant.health_declaration === "prefer_not" ? "Prefer not to say" : "None declared"}
                  </p>
                  {applicant.health_details && (
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{applicant.health_details}</p>
                  )}
                </div>
              )}

              {/* Staff relationship */}
              {applicant.has_staff_relationship && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Relationship with existing staff</p>
                  <p className={cn("text-sm font-semibold", applicant.has_staff_relationship === "yes" ? "text-amber-600" : "text-green-700")}>
                    {applicant.has_staff_relationship === "yes" ? "Yes — disclosed" : "None declared"}
                  </p>
                  {applicant.staff_relationship_details && (
                    <p className="text-sm text-gray-700 mt-1">{applicant.staff_relationship_details}</p>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Equal Opportunities — full width, always last before status ── */}
      {(applicant.equal_opps_gender || applicant.equal_opps_age || applicant.equal_opps_ethnicity || applicant.equal_opps_disability || applicant.equal_opps_sexual_orientation || applicant.equal_opps_religion) && (
        <div className="card mt-4 bg-blue-50 border border-blue-100">
          <SectionHeading>Equal opportunities monitoring</SectionHeading>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Gender" value={applicant.equal_opps_gender} />
            <Field label="Age band" value={applicant.equal_opps_age} />
            <Field label="Ethnic origin" value={applicant.equal_opps_ethnicity} />
            <Field label="Disability" value={applicant.equal_opps_disability} />
            <Field label="Sexual orientation" value={applicant.equal_opps_sexual_orientation} />
            <Field label="Religion or belief" value={applicant.equal_opps_religion} />
          </div>
        </div>
      )}

      {/* ── Status update — bottom of page ── */}
      <div className="card mt-4">
        <SectionHeading>Update application status</SectionHeading>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Status</label>
            <select
              className="input-field text-sm"
              value={selectedStatus ?? applicant.status}
              disabled={saving}
              onChange={(e) => setSelectedStatus(e.target.value as ApplicationStatus)}
            >
              {(["pending", "reviewing", "shortlisted", "hired", "rejected"] as const).map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={confirmStatusChange}
            disabled={saving || selectedStatus === applicant.status}
            className={cn(
              "flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all whitespace-nowrap",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              selectedStatus === "hired" ? "bg-emerald-600 hover:bg-emerald-700" :
              selectedStatus === "rejected" ? "bg-red-600 hover:bg-red-700" :
              "bg-blue-600 hover:bg-blue-700"
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            {saving ? "Saving…" :
              selectedStatus === applicant.status ? "No changes" :
              selectedStatus === "hired" ? "Confirm offer" :
              selectedStatus === "rejected" ? "Confirm rejection" :
              `Confirm → ${selectedStatus}`}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

    </AdminLayout>
  );
}
