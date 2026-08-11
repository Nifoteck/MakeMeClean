import Stripe from "npm:stripe@16.12.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
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
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!supabaseUrl || !serviceKey || !stripeKey || !webhookSecret) {
      return json(500, { ok: false, error: "Server misconfiguration" });
    }

    const signature = req.headers.get("Stripe-Signature");
    if (!signature) return json(400, { ok: false, error: "Missing Stripe signature" });

    const payload = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id ?? session.client_reference_id ?? "";

      if (session.payment_status !== "paid" || !bookingId) {
        return json(200, { ok: true, ignored: true });
      }

      const supabase = createClient(supabaseUrl, serviceKey);
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
      let chargeId: string | null = null;

      if (paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge"],
        });
        const latestCharge = paymentIntent.latest_charge;
        chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id ?? null;
      }

      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("id, payment_status")
        .eq("id", bookingId)
        .single();

      if (bookingErr || !booking) {
        return json(404, { ok: false, error: "Booking not found" });
      }

      if (booking.payment_status !== "paid") {
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({
            payment_status: "paid",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_charge_id: chargeId,
          })
          .eq("id", bookingId);

        if (updateErr) {
          return json(500, { ok: false, error: updateErr.message });
        }

        try {
          await supabase.functions.invoke("notifications", {
            body: { type: "booking_confirmation", bookingId },
          });
        } catch (e) {
          console.error("[stripe-webhook] booking_confirmation failed:", e);
        }

        try {
          await supabase.functions.invoke("notifications", {
            body: { type: "payment_receipt", bookingId },
          });
        } catch (e) {
          console.error("[stripe-webhook] payment_receipt failed:", e);
        }
      }
    }

    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.updated" || event.type === "charge.dispute.closed") {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
      if (!chargeId) return json(200, { ok: true, ignored: true });

      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("id, user_id, stripe_payment_intent_id, stripe_charge_id, payment_status, price")
        .eq("stripe_charge_id", chargeId)
        .maybeSingle();

      if (bookingErr || !booking) return json(200, { ok: true, ignored: true });

      if (event.type === "charge.dispute.created" || event.type === "charge.dispute.updated") {
        await supabase.from("bookings").update({ payment_status: "disputed" }).eq("id", booking.id);

        const { data: existing } = await supabase
          .from("refund_requests")
          .select("id")
          .eq("booking_id", booking.id)
          .eq("source", "stripe_dispute")
          .eq("status", "pending")
          .maybeSingle();

        if (!existing) {
          await supabase.from("refund_requests").insert({
            booking_id: booking.id,
            user_id: booking.user_id,
            reason: `Stripe dispute opened${dispute.reason ? `: ${dispute.reason}` : ""}`,
            source: "stripe_dispute",
            stripe_charge_id: chargeId,
            stripe_payment_intent_id: booking.stripe_payment_intent_id ?? null,
            stripe_dispute_id: dispute.id,
          });
        }
      }

      if (event.type === "charge.dispute.closed") {
        await supabase
          .from("bookings")
          .update({
            payment_status: dispute.status === "won" ? "paid" : "refunded",
          })
          .eq("id", booking.id);

        await supabase
          .from("refund_requests")
          .update({
            status: dispute.status === "won" ? "rejected" : "approved",
            processed_at: new Date().toISOString(),
            admin_notes: `Stripe dispute closed: ${dispute.status}`,
          })
          .eq("booking_id", booking.id)
          .eq("source", "stripe_dispute")
          .eq("status", "pending");
      }
    }

    return json(200, { ok: true });
  } catch (e) {
    console.error("[stripe-webhook]", e);
    return json(400, { ok: false, error: String((e as Error)?.message ?? e) });
  }
});
