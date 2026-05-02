// Supabase Edge Function: notifications
// Receives an event (booking_confirmation/payment_receipt/booking_reminder),
// loads booking + customer email from DB, then sends via Brevo Transactional Email API.

import { createClient } from "jsr:@supabase/supabase-js@2";

type NotificationEvent =
  | { type: "booking_confirmation"; bookingId: string }
  | { type: "payment_receipt"; bookingId: string }
  | { type: "booking_reminder"; bookingId: string };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function corsHeaders() {
  const origin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function mustGetEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatGBP(penceOrNumber: number) {
  const amount = typeof penceOrNumber === "number" ? penceOrNumber : Number(penceOrNumber);
  return `£${amount.toFixed(2)}`;
}

function buildEmail(event: NotificationEvent, booking: any) {
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  const bookingUrl = siteUrl ? `${siteUrl.replace(/\/$/, "")}/bookings/${booking.id}` : "";
  const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? "support@makemeclean.co.uk";
  const paymentsEmail = Deno.env.get("PAYMENTS_EMAIL") ?? "payment@makemeclean.co.uk";

  const safeService = escapeHtml(String(booking.service_name ?? "Cleaning"));
  const safeDate = escapeHtml(String(booking.date ?? ""));
  const safeTime = escapeHtml(String(booking.time_slot ?? ""));
  const safeCity = escapeHtml(String(booking.city ?? ""));
  const safeInvoice = escapeHtml(String(booking.invoice_number ?? ""));
  const safePrice = formatGBP(Number(booking.price ?? 0));
  const invoiceNumber = escapeHtml(String(booking.invoice_number ?? booking.id));

  const font = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  const bg = "#f6f7fb";
  const border = "#e5e7eb";
  const divider = "#eef2f7";

  const styles = {
    body: `margin:0;padding:0;background:${bg}`,
    container: "width:100%;padding:28px 12px",
    card: `width:100%;max-width:640px;background:#ffffff;border:1px solid ${border};border-radius:20px;overflow:hidden`,
    header: `padding:22px 22px 16px;border-bottom:1px solid ${divider}`,
    brand: `font-family:${font};font-weight:900;font-size:22px;line-height:1.1;color:#111827;margin:0`,
    meta: `font-family:${font};font-weight:600;font-size:12px;line-height:1.4;color:#6b7280;margin:6px 0 0`,
    bodyCell: `padding:18px 22px;font-family:${font}`,
    h2: `margin:0 0 10px;font-weight:900;font-size:18px;line-height:1.2;color:#111827`,
    p: `margin:0 0 12px;font-weight:500;font-size:14px;line-height:1.6;color:#374151`,
    panel: `border:1px solid ${border};border-radius:16px;overflow:hidden`,
    panelHeader: `background:#f9fafb;padding:12px 14px;font-family:${font};font-weight:800;font-size:12px;line-height:1.4;color:#111827`,
    rowLabel: `font-family:${font};font-weight:700;font-size:13px;line-height:1.6;color:#6b7280;padding:10px 14px;border-top:1px solid ${divider}`,
    rowValue: `font-family:${font};font-weight:900;font-size:13px;line-height:1.6;color:#111827;padding:10px 14px;border-top:1px solid ${divider};text-align:right`,
    cta: `display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-family:${font};font-weight:900;font-size:14px;line-height:1;padding:12px 16px;border-radius:12px`,
    hr: `height:1px;background:${divider};margin:16px 0`,
    small: `margin:0;font-weight:500;font-size:12px;line-height:1.6;color:#6b7280;font-family:${font}`,
    footer: `padding:14px 22px 22px;font-family:${font}`,
  } as const;

  const panelRow = (label: string, value: string) =>
    `<tr><td style="${styles.rowLabel}">${label}</td><td style="${styles.rowValue}">${value}</td></tr>`;

  const emailShell = (args: {
    preheader: string;
    heading: string;
    intro: string;
    panelTitle: string;
    panelRows: string;
    ctaHref?: string;
    ctaLabel?: string;
    helpText: string;
  }) =>
    `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width" />
          <meta name="x-apple-disable-message-reformatting" />
          <title>${escapeHtml(args.heading)}</title>
        </head>
        <body style="${styles.body}">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
            ${escapeHtml(args.preheader)}
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${styles.container}">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${styles.card}">
                  <tr>
                    <td style="${styles.header}">
                      <p style="${styles.brand}">MakeMeClean</p>
                      <p style="${styles.meta}">${escapeHtml(args.heading)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="${styles.bodyCell}">
                      <h2 style="${styles.h2}">${escapeHtml(args.heading)}</h2>
                      <p style="${styles.p}">${escapeHtml(args.intro)}</p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${styles.panel}">
                        <tr><td colspan="2" style="${styles.panelHeader}">${escapeHtml(args.panelTitle)}</td></tr>
                        ${args.panelRows}
                      </table>

                      ${args.ctaHref ? `<p style="margin:16px 0 0"><a href="${args.ctaHref}" style="${styles.cta}">${escapeHtml(args.ctaLabel ?? "View details")}</a></p>` : ""}
                      <div style="${styles.hr}"></div>
                      <p style="${styles.small}">${escapeHtml(args.helpText)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="${styles.footer}">
                      <p style="${styles.small}">MakeMeClean • Wales, UK</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `.trim();

  if (event.type === "booking_confirmation") {
    return {
      subject: `Booking confirmed: ${safeService}`,
      html: emailShell({
        preheader: `Booking confirmed for ${safeDate} ${safeTime}`,
        heading: "Booking confirmation",
        intro: "Thanks for booking with MakeMeClean. Your booking is confirmed and scheduled.",
        panelTitle: "Booking details",
        panelRows: [
          panelRow("Service", safeService),
          panelRow("Date", safeDate),
          panelRow("Time", safeTime),
          panelRow("City", safeCity),
          panelRow("Booking reference", escapeHtml(String(booking.id))),
        ].join(""),
        ctaHref: bookingUrl || undefined,
        ctaLabel: "View booking",
        helpText: `Need to change something? Reply to this email or contact ${supportEmail}.`,
      }),
    };
  }

  if (event.type === "payment_receipt") {
    return {
      subject: `Payment received${safeInvoice ? ` • ${safeInvoice}` : ""}`,
      html: emailShell({
        preheader: `Receipt for invoice ${invoiceNumber}`,
        heading: "Payment receipt",
        intro: "Thanks — we’ve received your payment. This email is your receipt.",
        panelTitle: `Invoice • ${invoiceNumber}`,
        panelRows: [
          panelRow("Service", safeService),
          panelRow("Date", safeDate),
          panelRow("Total paid", escapeHtml(safePrice)),
        ].join(""),
        ctaHref: bookingUrl || undefined,
        ctaLabel: "View booking",
        helpText: `Questions about this invoice? Email ${paymentsEmail}.`,
      }),
    };
  }

  // booking_reminder
  return {
    subject: `Reminder: ${safeService} on ${safeDate}`,
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
        <h2 style="margin:0 0 12px">Booking reminder</h2>
        <p style="margin:0 0 12px">Just a reminder about your upcoming clean.</p>
        <ul style="margin:0 0 16px; padding-left: 18px">
          <li><b>Service:</b> ${safeService}</li>
          <li><b>Date:</b> ${safeDate}</li>
          <li><b>Time:</b> ${safeTime}</li>
          <li><b>City:</b> ${safeCity}</li>
        </ul>
        ${bookingUrl ? `<p style="margin:0 0 16px"><a href="${bookingUrl}">View booking</a></p>` : ""}
      </div>
    `.trim(),
  };
}

function senderForEvent(event: NotificationEvent) {
  if (event.type === "booking_confirmation") {
    return { email: "booking@makemeclean.co.uk", name: "MakeMeClean Bookings" };
  }

  if (event.type === "payment_receipt") {
    return { email: "payment@makemeclean.co.uk", name: "MakeMeClean Payments" };
  }

  // Fallback sender (e.g. reminders)
  return { email: "info@makemeclean.co.uk", name: "MakeMeClean" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const payload = (await req.json()) as NotificationEvent;
    if (!payload?.type || !payload?.bookingId) return json(400, { error: "Invalid payload" });

    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, user_id, service_name, date, time_slot, city, price, invoice_number, payment_status")
      .eq("id", payload.bookingId)
      .single();

    if (error || !booking) return json(404, { error: "Booking not found" });

    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(booking.user_id);
    if (userErr || !userData?.user?.email) return json(400, { error: "Customer email not found" });

    const email = buildEmail(payload, booking);
    const sender = senderForEvent(payload);
    await (async () => {
      const apiKey = mustGetEnv("BREVO_API_KEY");
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender,
          to: [{ email: userData.user.email }],
          subject: email.subject,
          htmlContent: email.html,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Brevo error (${res.status}): ${text}`);
      }
    })();

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e?.message ?? e) });
  }
});
