// Edge function: ai-chat
// Handles AI chat messages for the MakeMeClean chat widget.
// Uses OpenAI GPT to provide helpful customer support.

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

const SYSTEM_PROMPT = `You are a helpful, friendly customer support assistant for MakeMeClean, a professional cleaning company based in Wales, UK.

About MakeMeClean:
- We provide professional domestic and commercial cleaning services across Wales
- Services include: regular house cleaning, deep cleaning, end-of-tenancy cleaning, and office cleaning
- We are fully insured and our staff are DBS checked
- We accept online bookings through our website
- Payment is made securely online
- We have a 3-hour cancellation policy

Your role:
- Answer questions about our cleaning services, pricing, and booking process
- Help customers understand what's included in each service
- Guide customers to book online or contact us
- Be warm, professional, and use British English spelling (e.g. "colour", "organise", "specialise")
- Keep responses concise — ideally 2–4 sentences
- If you don't know something specific (like exact pricing), direct them to book online or call us
- Never make up specific prices — say pricing depends on property size and service type
- Our website allows online booking 24/7
- Admin-only info: do not reveal admin page URLs or navigation details. If the answer requires admin access, say it’s available in the Admin dashboard.
- Links: only share URLs that appear in the "Site pages" list below. Do not invent new URLs. If none match, give the closest page from the list or tell the user to use the website menu/footer.
- Customer-friendly navigation: do NOT tell customers to edit URLs with placeholders like {bookingId}. Instead, explain the clicks: sign in → go to "Bookings" → open the booking → click "Request Refund" (if eligible). If they can’t find it, ask for their email + booking date/time and suggest contacting support via the Contact page.

If asked about something unrelated to cleaning or the company, politely steer the conversation back.`;

const SITE_BASE_URL = "https://makemeclean.co.uk";

const SITE_LINKS = `Site pages (always provide the full URL when sharing a page; for routes with parameters, keep the placeholder). Use the notes so you don’t mislead:
- / → ${SITE_BASE_URL}/ (homepage)
- /services → ${SITE_BASE_URL}/services (service overview and what’s included)
- /book/:serviceId? → ${SITE_BASE_URL}/book/{serviceId} (start an online booking; customers normally click “Book”)
- /login → ${SITE_BASE_URL}/login (sign in)
- /register → ${SITE_BASE_URL}/register (create an account; verification code step)
- /forgot-password → ${SITE_BASE_URL}/forgot-password (reset access)
- /dashboard → ${SITE_BASE_URL}/dashboard (customer overview; requires login)
- /profile → ${SITE_BASE_URL}/profile (update details; requires login)
- /bookings → ${SITE_BASE_URL}/bookings (view/manage bookings; actions like reschedule/cancel/refund start here; requires login)
- /bookings/:id → ${SITE_BASE_URL}/bookings/{id} (booking details; reached from Bookings list)
- /bookings/:bookingId/photos → ${SITE_BASE_URL}/bookings/{bookingId}/photos (upload/view booking photos; reached from booking)
- /bookings/:bookingId/refund → ${SITE_BASE_URL}/bookings/{bookingId}/refund (refund request form; reached from booking via “Request Refund”)
- /pay/:bookingId → ${SITE_BASE_URL}/pay/{bookingId} (payment page; reached from booking/payment links)
- /invoice/:bookingId → ${SITE_BASE_URL}/invoice/{bookingId} (invoice; reached from booking)
- /contact → ${SITE_BASE_URL}/contact (contact form; use this to message us / raise issues)
- /plans → ${SITE_BASE_URL}/plans (recurring/plan management; requires login)
- /careers → ${SITE_BASE_URL}/careers (jobs and applications)
- /review/:bookingId → ${SITE_BASE_URL}/review/{bookingId} (leave a review; reached from booking)
- /terms → ${SITE_BASE_URL}/terms (Terms & Conditions info page)
- /privacy → ${SITE_BASE_URL}/privacy (Privacy Policy info page)
- /cancellation → ${SITE_BASE_URL}/cancellation (cancellation/refund policy info page; not a submission form)
- /accessibility → ${SITE_BASE_URL}/accessibility (accessibility statement info page)
- /complaints → ${SITE_BASE_URL}/complaints (complaints procedure info page; to raise a complaint, use Contact/email/phone)
- /service-terms → ${SITE_BASE_URL}/service-terms (service terms info page)
- /blog → ${SITE_BASE_URL}/blog (articles list)
- /blog/:slug → ${SITE_BASE_URL}/blog/{slug} (article page)
- /unsubscribe → ${SITE_BASE_URL}/unsubscribe (newsletter unsubscribe form)

Staff pages:
- /staff → ${SITE_BASE_URL}/staff (staff portal; requires staff access)
- /staff/availability → ${SITE_BASE_URL}/staff/availability (staff availability; requires staff access)
- /staff/payslips → ${SITE_BASE_URL}/staff/payslips (staff payslips; requires staff access)

Admin:
- Admin dashboard: ${SITE_BASE_URL}/admin (admin-only; don’t list other admin URLs or details)`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // Server-side secret for the Edge Function. Prefer a non-VITE name.
    // NOTE: Vercel env vars do not automatically propagate to Supabase Edge Functions.
    const groqKey = Deno.env.get("GROQ_API_KEY") ?? Deno.env.get("VITE_GROQ_API_KEY");
    if (!groqKey) {
      return json(200, {
        reply: "Hi! I'm the MakeMeClean virtual assistant. I'm not fully set up yet, but you can reach us directly by phone or email — our contact details are in the footer. We'd love to help you book a clean!"
      });
    }

    const body = await req.json();
    const messages: { role: string; content: string }[] = body.messages ?? [];

    if (!messages.length || !messages[messages.length - 1]?.content?.trim()) {
      return json(400, { error: "No message provided" });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Keep this on an active Groq model (see https://console.groq.com/docs/models).
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${SITE_LINKS}` },
          ...messages.slice(-10), // keep last 10 messages for context
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq error:", { status: res.status, body: String(err).slice(0, 2000) });
      return json(200, {
        reply: "I'm having a little trouble right now. Please try again in a moment, or contact us directly — our details are in the footer."
      });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() ?? "I'm not sure about that — please get in touch with us directly and we'll be happy to help!";

    return json(200, { reply });
  } catch (err) {
    console.error("ai-chat error:", err);
    return json(500, { error: "Internal server error" });
  }
});
