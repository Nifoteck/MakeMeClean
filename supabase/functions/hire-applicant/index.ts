// Supabase Edge Function: hire-applicant
// Admin-only: creates a Supabase Auth user for a hired applicant, creates/updates staff row, emails temporary credentials.

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
              Your staff portal access is ready. Use the details below to sign in at <b>/login</b>. You’ll be asked to change your password after login.
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
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = mustGetEnv("ANON_KEY");

    // Verify caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json(401, { ok: false, error: "Unauthorized" });

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await adminClient.from("admins").select("user_id").eq("user_id", authData.user.id).maybeSingle();
    if (!adminRow) return json(403, { ok: false, error: "Forbidden" });

    const { applicationId } = (await req.json()) as { applicationId?: string };
    if (!applicationId) return json(400, { ok: false, error: "Missing applicationId" });

    const { data: app, error: appErr } = await adminClient.from("job_applications").select("*").eq("id", applicationId).single();
    if (appErr || !app) return json(404, { ok: false, error: "Applicant not found" });

    const tempPassword = randomPassword();
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: app.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true, staff_role: app.role ?? "Staff" },
    });
    if (createErr || !created?.user?.id) return json(500, { ok: false, error: createErr?.message ?? "Failed to create user" });

    // Staff row (upsert by email)
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
    const { error: staffErr } = await adminClient.from("staff").upsert(staffRow, { onConflict: "email" });
    if (staffErr) return json(500, { ok: false, error: staffErr.message });

    await adminClient.from("job_applications").update({ status: "hired" }).eq("id", app.id);
    await sendRecruitmentEmail({ toEmail: app.email, tempPassword });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { ok: false, error: String((e as any)?.message ?? e) });
  }
});
