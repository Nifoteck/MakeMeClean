// Supabase Edge Function: assign-staff
// Admin-only: assigns a staff member to a booking and emails them the shift details.

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
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(raw: string) {
  try {
    return new Date(raw).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return raw;
  }
}

function buildAssignmentEmail(args: {
  staffFirstName: string;
  serviceName: string;
  date: string;
  timeSlot: string;
  address: string;
  city: string;
  postcode: string;
  customerName: string;
  notes: string | null;
  portalUrl: string;
}) {
  const font = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  const bg = "#f6f7fb";
  const border = "#e5e7eb";
  const divider = "#eef2f7";

  const safe = (v: string | null | undefined) => escapeHtml(String(v ?? ""));

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 14px;border-top:1px solid ${divider};font-family:${font};font-weight:700;font-size:13px;line-height:1.6;color:#6b7280">${label}</td>
      <td style="padding:10px 14px;border-top:1px solid ${divider};font-family:${font};font-weight:900;font-size:13px;line-height:1.6;color:#111827;text-align:right">${value}</td>
    </tr>`;

  const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? "info@makemeclean.co.uk";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>Shift assignment — MakeMeClean</title>
  </head>
  <body style="margin:0;padding:0;background:${bg}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
      You have been assigned a new cleaning shift on ${safe(formatDate(args.date))}.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:640px;background:#ffffff;border:1px solid ${border};border-radius:20px;overflow:hidden">

          <!-- Header -->
          <tr><td style="padding:22px 22px 16px;border-bottom:1px solid ${divider}">
            <p style="margin:0;font-family:${font};font-weight:900;font-size:22px;color:#111827">MakeMeClean</p>
            <p style="margin:6px 0 0;font-family:${font};font-weight:600;font-size:12px;color:#6b7280">Shift assignment notification</p>
          </td></tr>

          <!-- Body -->
          <tr><td style="padding:20px 22px;font-family:${font}">
            <h2 style="margin:0 0 10px;font-weight:900;font-size:18px;color:#111827">
              You have been assigned a shift
            </h2>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151">
              Dear ${safe(args.staffFirstName)},<br /><br />
              You have been assigned to the following cleaning job. Please review the details below
              and make sure you are available on the scheduled date. Log in to your staff portal
              to view your full schedule.
            </p>

            <!-- Shift details panel -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                   style="border:1px solid ${border};border-radius:16px;overflow:hidden">
              <tr>
                <td colspan="2" style="background:#f9fafb;padding:12px 14px;font-family:${font};font-weight:800;font-size:12px;line-height:1.4;color:#111827;text-transform:uppercase;letter-spacing:.05em">
                  Shift details
                </td>
              </tr>
              ${row("Service", safe(args.serviceName))}
              ${row("Date", safe(formatDate(args.date)))}
              ${row("Time", safe(args.timeSlot))}
              ${row("Address", safe(args.address))}
              ${row("City", safe(args.city))}
              ${row("Postcode", safe(args.postcode))}
              ${args.customerName ? row("Customer", safe(args.customerName)) : ""}
              ${args.notes ? row("Notes", safe(args.notes)) : ""}
            </table>

            <!-- Important notice -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                   style="margin-top:16px;border:1px solid #fde68a;border-radius:16px;overflow:hidden;background:#fffbeb">
              <tr>
                <td style="padding:12px 16px;font-family:${font};font-size:13px;line-height:1.6;color:#92400e;font-weight:600">
                  ⚠ Please ensure you arrive on time. If you are unable to attend,
                  contact us immediately so we can make alternative arrangements.
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <p style="margin:20px 0 0">
              <a href="${safe(args.portalUrl)}"
                 style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-family:${font};font-weight:900;font-size:14px;line-height:1;padding:12px 20px;border-radius:12px">
                View my shifts
              </a>
            </p>

            <div style="height:1px;background:${divider};margin:20px 0"></div>
            <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;font-family:${font}">
              Questions about this assignment? Do not reply to this email —
              contact your manager at <a href="mailto:${safe(supportEmail)}" style="color:#16a34a">${safe(supportEmail)}</a>.
            </p>
          </td></tr>

          <!-- Footer -->
          <tr><td style="padding:14px 22px 22px">
            <p style="margin:0;font-family:${font};font-size:12px;line-height:1.6;color:#9ca3af">
              MakeMeClean • Wales, UK<br />
              This message was sent to you because you are a registered member of MakeMeClean staff.
            </p>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
</html>`;
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
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json(401, { ok: false, error: "Unauthorised" });

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await adminClient
      .from("admins").select("user_id").eq("user_id", authData.user.id).maybeSingle();
    if (!adminRow) return json(403, { ok: false, error: "Forbidden" });

    const { bookingId, staffId } = (await req.json()) as { bookingId?: string; staffId?: string };
    if (!bookingId) return json(400, { ok: false, error: "Missing bookingId" });

    // Fetch booking + customer name
    const { data: booking, error: bErr } = await adminClient
      .from("bookings")
      .select("id, service_name, date, time_slot, address, city, postcode, notes, user_id, profiles(full_name)")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return json(404, { ok: false, error: "Booking not found" });

    // Remove any existing assignment first
    await adminClient.from("booking_assignments").delete().eq("booking_id", bookingId);

    // If staffId is empty, this is an unassign — we're done
    if (!staffId) return json(200, { ok: true, action: "unassigned" });

    // Fetch staff record (including email)
    const { data: staffRow, error: sErr } = await adminClient
      .from("staff")
      .select("id, first_name, last_name, email")
      .eq("id", staffId)
      .single();
    if (sErr || !staffRow) return json(404, { ok: false, error: "Staff member not found" });

    // Save assignment
    const { error: aErr } = await adminClient.from("booking_assignments").insert({
      booking_id: bookingId,
      staff_id: staffId,
      assigned_at: new Date().toISOString(),
      status: "assigned",
    });
    if (aErr) return json(500, { ok: false, error: aErr.message });

    // Send email via Brevo
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey && staffRow.email) {
      const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
      const portalUrl = siteUrl ? `${siteUrl}/staff` : "/staff";
      const customerName = (booking.profiles as any)?.full_name ?? "";

      const html = buildAssignmentEmail({
        staffFirstName: staffRow.first_name,
        serviceName: booking.service_name,
        date: booking.date,
        timeSlot: booking.time_slot,
        address: booking.address,
        city: booking.city,
        postcode: booking.postcode,
        customerName,
        notes: booking.notes,
        portalUrl,
      });

      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": brevoKey,
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: { email: "staffing@makemeclean.co.uk", name: "MakeMeClean Staffing" },
            to: [{ email: staffRow.email, name: `${staffRow.first_name} ${staffRow.last_name}` }],
            subject: `Shift assigned — ${booking.service_name} on ${booking.date}`,
            htmlContent: html,
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`[assign-staff] Brevo error ${res.status}: ${text}`);
        }
      } catch (emailErr) {
        console.error("[assign-staff] Email send failed:", emailErr);
        // Non-fatal — assignment is already saved
      }
    }

    return json(200, { ok: true, action: "assigned" });
  } catch (e) {
    return json(500, { ok: false, error: String((e as any)?.message ?? e) });
  }
});
