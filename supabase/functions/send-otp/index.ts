// Edge Function: send-otp
// Generates a 6-digit OTP, saves to DB, and emails it via Brevo.

import { createClient } from "jsr:@supabase/supabase-js@2";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
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

function generateOtp(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
  return String(100000 + (num % 900000));
}

async function sendOtpEmail(toEmail: string, otp: string, purpose: string) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY not set");

  const isCareer = purpose === "careers";
  const subject = isCareer
    ? "Your MakeMeClean application verification code"
    : "Verify your MakeMeClean account";

  const html = `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
        <tr>
          <td style="background:#16a34a;padding:20px 28px">
            <span style="font-weight:900;font-size:20px;color:#fff;letter-spacing:-0.5px">MakeMeClean</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 12px">
            <h2 style="margin:0 0 10px;font-weight:800;font-size:20px;color:#111827">
              ${isCareer ? "Verify your email to continue your application" : "Confirm your email address"}
            </h2>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#6b7280">
              ${isCareer
                ? "Enter this code to verify your email and save your application progress."
                : "Enter this code on the verification screen to create your account."}
            </p>
            <div style="background:#f9fafb;border:2px dashed #d1fae5;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Your verification code</p>
              <span style="font-size:40px;font-weight:900;color:#16a34a;letter-spacing:8px;font-family:monospace">${otp}</span>
            </div>
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
              This code expires in <strong>15 minutes</strong>. If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 24px;border-top:1px solid #f3f4f6">
            <p style="margin:0;font-size:11px;color:#d1d5db">MakeMeClean · Wales, UK · no-reply@makemeclean.co.uk</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: "no-reply@makemeclean.co.uk", name: "MakeMeClean" },
      to: [{ email: toEmail }],
      subject,
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json(500, { ok: false, error: "Server misconfiguration" });

    const { email, purpose } = (await req.json()) as { email?: string; purpose?: string };
    if (!email || !email.includes("@")) return json(400, { ok: false, error: "Valid email required" });

    const validPurposes = ["registration", "careers"];
    const resolvedPurpose = validPurposes.includes(purpose ?? "") ? purpose! : "registration";

    const db = createClient(supabaseUrl, serviceKey);

    // Rate-limit: max 3 OTPs per email per purpose per 10 minutes
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await db
      .from("email_verifications")
      .select("id", { count: "exact", head: true })
      .eq("email", email.toLowerCase())
      .eq("purpose", resolvedPurpose)
      .gte("created_at", tenMinsAgo);

    if ((count ?? 0) >= 3) {
      return json(429, { ok: false, error: "Too many attempts. Please wait a few minutes." });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Delete old unexpired OTPs for this email+purpose before inserting new one
    await db
      .from("email_verifications")
      .delete()
      .eq("email", email.toLowerCase())
      .eq("purpose", resolvedPurpose)
      .is("verified_at", null);

    await db.from("email_verifications").insert({
      email: email.toLowerCase(),
      purpose: resolvedPurpose,
      otp,
      expires_at: expiresAt,
    });

    await sendOtpEmail(email, otp, resolvedPurpose);

    return json(200, { ok: true });
  } catch (e) {
    console.error("send-otp error:", e);
    return json(500, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});
