// Supabase Edge Function: admin-api
// Password-gated admin operations using service role.

import { createClient } from "jsr:@supabase/supabase-js@2";

function corsHeaders() {
  const origin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function mustGetEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function safeEqual(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

type AdminRequest =
  | { password: string; action: "list_bookings" }
  | { password: string; action: "update_booking_status"; bookingId: string; status: string }
  | { password: string; action: "list_services" }
  | { password: string; action: "list_applicants" }
  | { password: string; action: "update_applicant"; id: string; patch: { status?: string; admin_notes?: string | null } }
  | { password: string; action: "hire_applicant"; applicationId: string }
  | { password: string; action: "list_staff" }
  | { password: string; action: "create_staff_from_applicant"; applicationId: string }
  | { password: string; action: "update_staff"; id: string; patch: { active?: boolean; notes?: string | null; role?: string | null } }
  | {
      password: string;
      action: "upsert_service";
      service: {
        id: string;
        name: string;
        description: string;
        price: number;
        duration: string;
        icon_key: string;
        popular: boolean;
        active: boolean;
        sort_order: number;
      };
    };

function randomPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function sendRecruitmentEmail(args: { toEmail: string; tempPassword: string }) {
  const apiKey = mustGetEnv("BREVO_API_KEY");
  const sender = { email: "recruitment@makemeclean.co.uk", name: "MakeMeClean Recruitment" };

  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
          <tr><td style="padding:22px 22px 16px;border-bottom:1px solid #eef2f7">
            <div style="font-weight:900;font-size:22px;color:#111827">MakeMeClean</div>
            <div style="font-weight:600;font-size:12px;color:#6b7280;margin-top:6px">Staff account created</div>
          </td></tr>
          <tr><td style="padding:18px 22px">
            <h2 style="margin:0 0 10px;font-weight:900;font-size:18px;color:#111827">Welcome onboard</h2>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151">
              Your staff portal access is ready. Use the details below to sign in. You’ll be asked to change your password after login.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
              <tr><td colspan="2" style="background:#f9fafb;padding:12px 14px;font-weight:800;font-size:12px;color:#111827">Login details</td></tr>
              <tr>
                <td style="padding:10px 14px;border-top:1px solid #eef2f7;font-weight:700;font-size:13px;color:#6b7280">Username</td>
                <td style="padding:10px 14px;border-top:1px solid #eef2f7;font-weight:900;font-size:13px;color:#111827;text-align:right">${args.toEmail}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;border-top:1px solid #eef2f7;font-weight:700;font-size:13px;color:#6b7280">Temporary password</td>
                <td style="padding:10px 14px;border-top:1px solid #eef2f7;font-weight:900;font-size:13px;color:#111827;text-align:right">${args.tempPassword}</td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#6b7280">
              For security, please change your password immediately after signing in.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
  `.trim();

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey, Accept: "application/json" },
    body: JSON.stringify({
      sender,
      to: [{ email: args.toEmail }],
      subject: "Your MakeMeClean staff portal login",
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo error (${res.status}): ${text}`);
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const payload = (await req.json()) as AdminRequest;
    const secret = Deno.env.get("ADMIN_PASSWORD");
    if (!secret) return json(500, { ok: false, error: "ADMIN_PASSWORD not set" });
    if (!payload?.password || !safeEqual(payload.password, secret)) return json(401, { ok: false, error: "Unauthorized" });

    const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"));

    if (payload.action === "list_bookings") {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, profiles(full_name, phone)")
        .order("created_at", { ascending: false });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, data });
    }

    if (payload.action === "update_booking_status") {
      const { error } = await supabase.from("bookings").update({ status: payload.status }).eq("id", payload.bookingId);
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true });
    }

    if (payload.action === "list_services") {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, price, duration, icon_key, popular, active, sort_order")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, data });
    }

    if (payload.action === "list_applicants") {
      const { data, error } = await supabase
        .from("job_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, data });
    }

    if (payload.action === "update_applicant") {
      const update: Record<string, unknown> = {};
      if (payload.patch?.status) update.status = payload.patch.status;
      if (payload.patch && "admin_notes" in payload.patch) update.admin_notes = payload.patch.admin_notes;
      const { error } = await supabase.from("job_applications").update(update).eq("id", payload.id);
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true });
    }

    if (payload.action === "hire_applicant") {
      const { data: app, error: appErr } = await supabase
        .from("job_applications")
        .select("*")
        .eq("id", payload.applicationId)
        .single();
      if (appErr || !app) return json(404, { ok: false, error: "Applicant not found" });

      const tempPassword = randomPassword();
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: app.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { must_change_password: true, staff_role: app.role ?? "Staff" },
      });
      if (createErr || !created?.user?.id) return json(500, { ok: false, error: createErr?.message ?? "Failed to create user" });

      const staffRow = {
        user_id: created.user.id,
        application_id: app.id,
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        phone: app.phone,
        city: app.city,
        postcode: app.postcode,
        role: app.role,
        active: true,
      };
      const { error: staffErr } = await supabase.from("staff").upsert(staffRow, { onConflict: "email" });
      if (staffErr) return json(500, { ok: false, error: staffErr.message });

      const { error: hireErr } = await supabase.from("job_applications").update({ status: "hired" }).eq("id", app.id);
      if (hireErr) return json(500, { ok: false, error: hireErr.message });

      await sendRecruitmentEmail({ toEmail: app.email, tempPassword });
      return json(200, { ok: true });
    }

    if (payload.action === "upsert_service") {
      const { error } = await supabase.from("services").upsert(payload.service, { onConflict: "id" });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true });
    }

    if (payload.action === "list_staff") {
      const { data, error } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, data });
    }

    if (payload.action === "create_staff_from_applicant") {
      const { data: app, error: appErr } = await supabase.from("job_applications").select("*").eq("id", payload.applicationId).single();
      if (appErr || !app) return json(404, { ok: false, error: "Applicant not found" });

      const staffRow = {
        application_id: app.id,
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        phone: app.phone,
        city: app.city,
        postcode: app.postcode,
        role: app.role,
        active: true,
      };
      const { data, error } = await supabase.from("staff").insert(staffRow).select("*").single();
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, data });
    }

    if (payload.action === "update_staff") {
      const update: Record<string, unknown> = {};
      if (payload.patch && "active" in payload.patch) update.active = payload.patch.active;
      if (payload.patch && "notes" in payload.patch) update.notes = payload.patch.notes;
      if (payload.patch && "role" in payload.patch) update.role = payload.patch.role;
      const { error } = await supabase.from("staff").update(update).eq("id", payload.id);
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: "Unknown action" });
  } catch (e) {
    return json(500, { ok: false, error: String((e as any)?.message ?? e) });
  }
});
