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

If asked about something unrelated to cleaning or the company, politely steer the conversation back.`;

const SITE_BASE_URL = "https://makemeclean.co.uk";

const SITE_LINKS = `Site pages (always provide the full URL when sharing a page; for routes with parameters, keep the placeholder):
- / → ${SITE_BASE_URL}/
- /services → ${SITE_BASE_URL}/services
- /book/:serviceId? → ${SITE_BASE_URL}/book/{serviceId}
- /login → ${SITE_BASE_URL}/login
- /register → ${SITE_BASE_URL}/register
- /forgot-password → ${SITE_BASE_URL}/forgot-password
- /dashboard → ${SITE_BASE_URL}/dashboard
- /profile → ${SITE_BASE_URL}/profile
- /bookings → ${SITE_BASE_URL}/bookings
- /bookings/:id → ${SITE_BASE_URL}/bookings/{id}
- /bookings/:bookingId/photos → ${SITE_BASE_URL}/bookings/{bookingId}/photos
- /bookings/:bookingId/refund → ${SITE_BASE_URL}/bookings/{bookingId}/refund
- /pay/:bookingId → ${SITE_BASE_URL}/pay/{bookingId}
- /invoice/:bookingId → ${SITE_BASE_URL}/invoice/{bookingId}
- /contact → ${SITE_BASE_URL}/contact
- /plans → ${SITE_BASE_URL}/plans
- /careers → ${SITE_BASE_URL}/careers
- /review/:bookingId → ${SITE_BASE_URL}/review/{bookingId}
- /terms → ${SITE_BASE_URL}/terms
- /privacy → ${SITE_BASE_URL}/privacy
- /cancellation → ${SITE_BASE_URL}/cancellation
- /accessibility → ${SITE_BASE_URL}/accessibility
- /complaints → ${SITE_BASE_URL}/complaints
- /service-terms → ${SITE_BASE_URL}/service-terms
- /blog → ${SITE_BASE_URL}/blog
- /blog/:slug → ${SITE_BASE_URL}/blog/{slug}
- /unsubscribe → ${SITE_BASE_URL}/unsubscribe

Staff pages:
- /staff → ${SITE_BASE_URL}/staff
- /staff/availability → ${SITE_BASE_URL}/staff/availability
- /staff/payslips → ${SITE_BASE_URL}/staff/payslips

Admin:
- Admin dashboard: ${SITE_BASE_URL}/admin (don’t list other admin URLs; if something is admin-only, say “go to the Admin dashboard” instead)`;

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
