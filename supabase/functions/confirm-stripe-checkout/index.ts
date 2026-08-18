import Stripe from "npm:stripe@16.12.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!supabaseUrl || !serviceKey || !stripeKey) {
      return json(500, { ok: false, error: "Server misconfiguration" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { ok: false, error: "Unauthorised" });

    const { bookingId, sessionId } = (await req.json()) as { bookingId?: string; sessionId?: string };
    if (!bookingId || !sessionId) return json(400, { ok: false, error: "bookingId and sessionId are required" });

    const supabase = createClient(supabaseUrl, serviceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { ok: false, error: "Unauthorised" });

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, user_id, payment_status")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) return json(404, { ok: false, error: "Booking not found" });
    if (booking.user_id !== userData.user.id) return json(403, { ok: false, error: "Forbidden" });
    if (booking.payment_status === "paid") return json(200, { ok: true, paid: true });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge"],
    });

    const sessionBookingId = session.metadata?.booking_id ?? session.client_reference_id ?? "";
    if (sessionBookingId !== booking.id) {
      return json(403, { ok: false, error: "Checkout session does not match this booking" });
    }

    if (session.payment_status !== "paid") {
      return json(200, { ok: true, paid: false });
    }

    const paymentIntent =
      typeof session.payment_intent === "string" ? null : session.payment_intent;
    const latestCharge = paymentIntent?.latest_charge;
    const chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id ?? null;

    const { error: updateErr } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntent?.id ?? (typeof session.payment_intent === "string" ? session.payment_intent : null),
        stripe_charge_id: chargeId,
      })
      .eq("id", booking.id);

    if (updateErr) return json(500, { ok: false, error: updateErr.message });

    return json(200, { ok: true, paid: true });
  } catch (e) {
    console.error("[confirm-stripe-checkout]", e);
    return json(500, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});
