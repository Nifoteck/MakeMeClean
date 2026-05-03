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

    if (!email || !password) {
      return json(400, { ok: false, error: "Email and password required" });
    }

    if (password.length < 6) {
      return json(400, { ok: false, error: "Password must be at least 6 characters" });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError || !users) {
      return json(500, { ok: false, error: "Failed to retrieve users" });
    }

    const authUser = users.find((u) => u.email === email);
    if (!authUser) {
      return json(404, { ok: false, error: "User not found" });
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
