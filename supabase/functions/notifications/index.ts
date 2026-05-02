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
    headers: { "Content-Type": "application/json" },
  });
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
  const bookingUrl = siteUrl ? `${siteUrl.replace(/\\/$/, "")}/bookings/${booking.id}` : "";

  const safeService = escapeHtml(String(booking.service_name ?? "Cleaning"));
  const safeDate = escapeHtml(String(booking.date ?? ""));
  const safeTime = escapeHtml(String(booking.time_slot ?? ""));
  const safeCity = escapeHtml(String(booking.city ?? ""));
  const safeInvoice = escapeHtml(String(booking.invoice_number ?? ""));
  const safePrice = formatGBP(Number(booking.price ?? 0));

  if (event.type === "booking_confirmation") {
    return {
      subject: `Booking confirmed: ${safeService}`,
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
          <h2 style="margin:0 0 12px">Your booking is confirmed</h2>
          <p style="margin:0 0 12px">Thanks for booking with MakeMeClean.</p>
          <ul style="margin:0 0 16px; padding-left: 18px">
            <li><b>Service:</b> ${safeService}</li>
            <li><b>Date:</b> ${safeDate}</li>
            <li><b>Time:</b> ${safeTime}</li>
            <li><b>City:</b> ${safeCity}</li>
            ${safeInvoice ? `<li><b>Invoice:</b> ${safeInvoice}</li>` : ""}
          </ul>
          ${bookingUrl ? `<p style="margin:0 0 16px"><a href="${bookingUrl}">View booking</a></p>` : ""}
          <p style="margin:0;color:#6b7280;font-size:12px">If you need to make changes, reply to this email.</p>
        </div>
      `.trim(),
    };
  }

  if (event.type === "payment_receipt") {
    return {
      subject: `Payment received${safeInvoice ? ` • ${safeInvoice}` : ""}`,
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
          <h2 style="margin:0 0 12px">Payment receipt</h2>
          <p style="margin:0 0 12px">We’ve received your payment.</p>
          <ul style="margin:0 0 16px; padding-left: 18px">
            <li><b>Service:</b> ${safeService}</li>
            <li><b>Date:</b> ${safeDate}</li>
            <li><b>Amount:</b> ${escapeHtml(safePrice)}</li>
            ${safeInvoice ? `<li><b>Invoice:</b> ${safeInvoice}</li>` : ""}
          </ul>
          ${bookingUrl ? `<p style="margin:0 0 16px"><a href="${bookingUrl}">View booking</a></p>` : ""}
          <p style="margin:0;color:#6b7280;font-size:12px">Thank you for choosing MakeMeClean.</p>
        </div>
      `.trim(),
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

async function sendBrevoEmail(args: { toEmail: string; subject: string; html: string }) {
  const apiKey = mustGetEnv("BREVO_API_KEY");
  const senderEmail = mustGetEnv("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") ?? "MakeMeClean";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: args.toEmail }],
      subject: args.subject,
      htmlContent: args.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo error (${res.status}): ${text}`);
  }
}

Deno.serve(async (req) => {
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
    await sendBrevoEmail({ toEmail: userData.user.email, subject: email.subject, html: email.html });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e?.message ?? e) });
  }
});

