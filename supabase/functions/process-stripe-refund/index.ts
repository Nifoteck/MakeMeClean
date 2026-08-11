import Stripe from "npm:stripe@16.12.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

async function requireAdmin(req: Request, supabaseUrl: string, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false as const, response: json(401, { ok: false, error: "Unauthorised" }) };

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false as const, response: json(401, { ok: false, error: "Unauthorised" }) };
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!admin) {
    return { ok: false as const, response: json(403, { ok: false, error: "Forbidden" }) };
  }

  return { ok: true as const, supabase, user: userData.user };
}

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

    const adminCheck = await requireAdmin(req, supabaseUrl, serviceKey);
    if (!adminCheck.ok) return adminCheck.response;

    const { refundRequestId } = (await req.json()) as { refundRequestId?: string };
    if (!refundRequestId) return json(400, { ok: false, error: "refundRequestId is required" });

    const supabase = adminCheck.supabase;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const { data: refundRequest, error: refundErr } = await supabase
      .from("refund_requests")
      .select("id, booking_id, user_id, reason, status, refund_amount, source, stripe_refund_id, stripe_payment_intent_id, stripe_charge_id")
      .eq("id", refundRequestId)
      .single();

    if (refundErr || !refundRequest) return json(404, { ok: false, error: "Refund request not found" });
    if (refundRequest.status !== "pending") return json(409, { ok: false, error: "Refund request already processed" });

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, user_id, price, payment_status, stripe_payment_intent_id, stripe_charge_id, refunded_amount")
      .eq("id", refundRequest.booking_id)
      .single();

    if (bookingErr || !booking) return json(404, { ok: false, error: "Booking not found" });
    if (booking.user_id !== refundRequest.user_id) {
      return json(409, { ok: false, error: "Refund request does not match booking owner" });
    }
    if (refundRequest.source === "user" && booking.payment_status !== "paid") {
      return json(409, { ok: false, error: "Only paid bookings can be refunded" });
    }

    const paymentIntentId = booking.stripe_payment_intent_id ?? refundRequest.stripe_payment_intent_id ?? null;
    if (!paymentIntentId) {
      return json(400, { ok: false, error: "Missing Stripe payment reference for this booking" });
    }

    const requestedAmount = Number(refundRequest.refund_amount ?? booking.price);
    const refundAmount = Math.max(0, Math.round(requestedAmount * 100));
    const paymentAmount = Math.round(Number(booking.price) * 100);
    const effectiveAmount = refundAmount > 0 ? Math.min(refundAmount, paymentAmount) : paymentAmount;

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: effectiveAmount,
      metadata: {
        booking_id: booking.id,
        refund_request_id: refundRequest.id,
      },
    });

    const refundedValue = effectiveAmount / 100;
    const fullRefund = effectiveAmount >= paymentAmount;

    const { error: updateRefundErr } = await supabase
      .from("refund_requests")
      .update({
        status: "approved",
        refund_amount: refundedValue,
        admin_notes: `Processed via Stripe refund${refundRequest.source === "stripe_dispute" ? " after dispute" : ""}`,
        processed_at: new Date().toISOString(),
        stripe_refund_id: refund.id,
      })
      .eq("id", refundRequest.id);

    if (updateRefundErr) return json(500, { ok: false, error: updateRefundErr.message });

    const { error: updateBookingErr } = await supabase
      .from("bookings")
      .update({
        payment_status: fullRefund ? "refunded" : "paid",
        refunded_amount: Number(booking.refunded_amount ?? 0) + refundedValue,
      })
      .eq("id", booking.id);

    if (updateBookingErr) return json(500, { ok: false, error: updateBookingErr.message });

    return json(200, { ok: true, refundId: refund.id, amount: refundedValue });
  } catch (e) {
    console.error("[process-stripe-refund]", e);
    return json(500, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});
