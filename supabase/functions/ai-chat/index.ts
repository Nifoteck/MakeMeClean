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

If asked about something unrelated to cleaning or the company, politely steer the conversation back.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const groqKey = Deno.env.get("VITE_GROQ_API_KEY");
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
        model: "mixtral-8x7b-32768",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-10), // keep last 10 messages for context
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Groq error:", err);
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
