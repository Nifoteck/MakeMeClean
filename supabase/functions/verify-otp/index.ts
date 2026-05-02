// Edge Function: verify-otp
// Checks a submitted OTP against the DB.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders() });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json(500, { ok: false, error: "Server misconfiguration" });

    const { email, otp, purpose } = (await req.json()) as {
      email?: string;
      otp?: string;
      purpose?: string;
    };

    if (!email || !otp || !purpose) {
      return json(400, { ok: false, error: "email, otp and purpose are required" });
    }

    const db = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();

    const { data, error } = await db
      .from("email_verifications")
      .select("id, otp, expires_at, verified_at")
      .eq("email", email.toLowerCase())
      .eq("purpose", purpose)
      .is("verified_at", null)
      .gte("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return json(200, { ok: true, verified: false, reason: "expired_or_not_found" });
    }

    if (data.otp !== otp.trim()) {
      return json(200, { ok: true, verified: false, reason: "wrong_code" });
    }

    // Mark as verified
    await db
      .from("email_verifications")
      .update({ verified_at: now })
      .eq("id", data.id);

    return json(200, { ok: true, verified: true });
  } catch (e) {
    console.error("verify-otp error:", e);
    return json(500, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});
