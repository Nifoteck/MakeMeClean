// Supabase Edge Function: admin-auth
// Verifies a shared admin password (stored as ADMIN_PASSWORD secret).

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

function safeEqual(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const { password } = (await req.json()) as { password?: string };
    const secret = Deno.env.get("ADMIN_PASSWORD");
    if (!secret) return json(500, { ok: false, error: "ADMIN_PASSWORD not set" });
    if (!password) return json(400, { ok: false, error: "Missing password" });
    return json(200, { ok: safeEqual(password, secret) });
  } catch (e) {
    return json(500, { ok: false, error: String((e as any)?.message ?? e) });
  }
});

