// Edge function: send-newsletter
// Sends newsletter to all active (unsubscribed_at IS NULL) newsletter subscribers via Brevo.

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

function escapeHtml(v: string) {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildNewsletterHtml(subject: string, bodyText: string) {
  const font = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  const safeBody = escapeHtml(bodyText).replaceAll("\n", "<br>");
  const safeSubject = escapeHtml(subject);

  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f6f7fb">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:22px 24px 16px;border-bottom:1px solid #eef2f7;background:#16a34a">
            <p style="margin:0;font-family:${font};font-weight:900;font-size:22px;color:#fff">MakeMeClean</p>
            <p style="margin:6px 0 0;font-family:${font};font-size:12px;font-weight:600;color:#dcfce7">Newsletter</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px;font-family:${font}">
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151">${safeBody}</p>
            <hr style="border:none;border-top:1px solid #eef2f7;margin:20px 0"/>
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af">
              MakeMeClean • Wales, UK<br>
              <a href="https://makemeclean.co.uk/unsubscribe" style="color:#16a34a;text-decoration:underline;font-weight:600">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    
    if (!brevoKey) return json(500, { error: "Brevo not configured" });

    // Verify caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json(401, { error: "Unauthorized" });

    const sb = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json(401, { error: "Invalid token" });

    const { data: admins } = await sb.from("admins").select("user_id").eq("user_id", user.id);
    if (!admins || admins.length === 0) return json(403, { error: "Not an admin" });

    // Parse request
    const body = await req.json();
    const { subject, bodyText } = body;

    if (!subject?.trim() || !bodyText?.trim()) {
      return json(400, { error: "Subject and body are required" });
    }

    // Fetch all active subscribers (unsubscribed_at IS NULL)
    const { data: subscribers, error: subErr } = await sb
      .from("newsletter_subscriptions")
      .select("email")
      .is("unsubscribed_at", null);

    if (subErr) return json(500, { error: `Failed to fetch subscribers: ${subErr.message}` });
    if (!subscribers || subscribers.length === 0) {
      return json(200, { ok: true, sent: 0, message: "No active subscribers" });
    }

    // Build email HTML
    const html = buildNewsletterHtml(subject, bodyText);

    // Send to each subscriber via Brevo
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sub of subscribers) {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: [{ email: sub.email }],
            sender: { email: "newsletter@makemeclean.co.uk", name: "MakeMeClean" },
            subject: subject,
            htmlContent: html,
            replyTo: { email: "contact@makemeclean.co.uk" },
          }),
        });

        if (res.ok) {
          sent++;
        } else {
          failed++;
          const text = await res.text();
          errors.push(`${sub.email}: ${text}`);
        }
      } catch (e) {
        failed++;
        errors.push(`${sub.email}: ${String(e)}`);
      }
    }

    return json(200, {
      ok: true,
      sent,
      failed,
      total: subscribers.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (err) {
    return json(500, { error: `Server error: ${String(err)}` });
  }
});
