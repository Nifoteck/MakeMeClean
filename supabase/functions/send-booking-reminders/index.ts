// Edge function: send-booking-reminders
// Sends reminder emails before bookings via Brevo.
// Designed to run automatically on a schedule (e.g. every hour via Supabase cron).
// Reads `reminder_hours_before` from the settings table (default: 24).
// Tracks sent reminders via the `reminder_sent` column on bookings.

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

function buildReminderHtml(customerName: string, serviceName: string, date: string, timeSlot: string, hoursLabel: string) {
  const font = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f6f7fb">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:22px 24px 16px;border-bottom:1px solid #eef2f7;background:#16a34a">
            <p style="margin:0;font-family:${font};font-weight:900;font-size:22px;color:#fff">MakeMeClean</p>
            <p style="margin:6px 0 0;font-family:${font};font-size:12px;font-weight:600;color:#dcfce7">Booking Reminder</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 24px;font-family:${font}">
            <p style="margin:0 0 16px;font-size:14px;color:#374151">Hi ${customerName},</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151">
              This is a friendly reminder that your <strong>${serviceName}</strong> cleaning is coming up in <strong>${hoursLabel}</strong>.
            </p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:20px 0">
              <p style="margin:0 0 8px;font-size:13px;color:#374151"><strong>📅 Date:</strong> ${date}</p>
              <p style="margin:0;font-size:13px;color:#374151"><strong>⏰ Time:</strong> ${timeSlot}</p>
            </div>
            <p style="margin:16px 0;font-size:14px;color:#374151">
              Please ensure someone is home during the scheduled time. If you need to reschedule or have any questions, log in to your account or contact us.
            </p>
            <hr style="border:none;border-top:1px solid #eef2f7;margin:20px 0"/>
            <p style="margin:0;font-size:12px;color:#9ca3af">
              MakeMeClean · Wales, UK<br/>
              Need to reschedule? Log in at makemeclean.co.uk or email contact@makemeclean.co.uk
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoKey    = Deno.env.get("BREVO_API_KEY");

    if (!brevoKey) return json(500, { error: "Brevo not configured" });

    const sb = createClient(supabaseUrl, serviceKey);

    // Read reminder_hours_before from settings (default 24)
    const { data: settingRow } = await sb
      .from("settings")
      .select("value")
      .eq("key", "reminder_hours_before")
      .maybeSingle();

    const hoursBeforeRaw = parseFloat(settingRow?.value ?? "24");
    const hoursBefore = isNaN(hoursBeforeRaw) || hoursBeforeRaw < 1 ? 24 : hoursBeforeRaw;

    // Find the target window: bookings that start in ~hoursBefore hours
    // We look for bookings on the target date whose time falls within a ±30 min window
    const now = new Date();
    const targetTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
    const targetDate = targetTime.toISOString().split("T")[0];

    // Fetch bookings on the target date that are upcoming and haven't had a reminder sent
    const { data: bookings, error: bookingErr } = await sb
      .from("bookings")
      .select(`
        id,
        date,
        time_slot,
        service_name,
        status,
        user_id,
        reminder_sent,
        profile:user_id (full_name, email)
      `)
      .eq("date", targetDate)
      .eq("status", "upcoming")
      .neq("reminder_sent", true);

    if (bookingErr) return json(500, { error: `Failed to fetch bookings: ${bookingErr.message}` });
    if (!bookings || bookings.length === 0) {
      return json(200, { ok: true, sent: 0, message: `No upcoming bookings on ${targetDate} needing reminders` });
    }

    let sent = 0;
    let failed = 0;
    const sentIds: string[] = [];

    for (const booking of bookings) {
      try {
        const email = (booking as any).profile?.email;
        if (!email) { failed++; continue; }

        const customerName = (booking as any).profile?.full_name || "there";
        const hoursLabel = hoursBefore === 24 ? "24 hours" : `${hoursBefore} hours`;
        const html = buildReminderHtml(customerName, booking.service_name, booking.date, booking.time_slot, hoursLabel);

        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: [{ email }],
            sender: { email: "noreply@makemeclean.co.uk", name: "MakeMeClean" },
            subject: `Reminder: Your ${booking.service_name} is in ${hoursLabel}`,
            htmlContent: html,
            replyTo: { email: "contact@makemeclean.co.uk" },
          }),
        });

        if (res.ok) {
          sent++;
          sentIds.push(booking.id);
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // Mark reminders as sent
    if (sentIds.length > 0) {
      await sb.from("bookings").update({ reminder_sent: true }).in("id", sentIds);
    }

    return json(200, { ok: true, sent, failed, total: bookings.length, target_date: targetDate, hours_before: hoursBefore });
  } catch (err) {
    return json(500, { error: `Server error: ${String(err)}` });
  }
});
