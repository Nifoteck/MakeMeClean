import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const json = (status: number, data: any) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      return json(400, { ok: false, error: "Email and password required" });
    }

    if (password.length < 6) {
      return json(400, { ok: false, error: "Password must be at least 6 characters" });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    let authUser = null as null | { id: string; email?: string | null };
    let page = 1;
    const perPage = 1000;

    while (!authUser) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) {
        return json(500, { ok: false, error: "Failed to retrieve users" });
      }

      const users = data?.users ?? [];
      if (!users.length) break;

      authUser = users.find((u) => u.email?.trim().toLowerCase() === normalizedEmail) ?? null;
      if (users.length < perPage) break;
      page += 1;
    }

    if (!authUser) {
      return json(404, { ok: false, error: "User not found for that email address" });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, { password });

    if (updateError) {
      console.error("[reset-password] Update error:", updateError);
      return json(500, { ok: false, error: updateError.message || "Failed to reset password" });
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return json(500, { ok: false, error: "Internal server error" });
  }
});
