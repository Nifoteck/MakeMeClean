import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleCors,
  verifyAuth,
  sendSuccess,
  sendError,
  getServerSupabase,
  STRIPE_SECRET_KEY,
  SITE_URL,
} from '../../_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  const bookingId = (req.query.id as string || '').trim();
  if (!bookingId) {
    return sendError(res, 'Booking ID is required', 400);
  }

  try {
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, user_id, service_name, date, time_slot, price, invoice_number, payment_status')
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.user_id !== user.id) {
      return sendError(res, 'You are not authorized to pay for this booking', 403);
    }

    if (booking.payment_status === 'paid') {
      return sendError(res, 'This booking has already been paid in full.', 400);
    }

    const body = req.body || {};
    const customReturnUrl = body.returnUrl || body.return_url;
    const amountInPence = Math.round(Number(booking.price) * 100);

    const successUrl =
      customReturnUrl ||
      `${SITE_URL}/booking-detail/${booking.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      customReturnUrl ||
      `${SITE_URL}/booking-detail/${booking.id}?payment=cancelled`;

    // If Stripe Secret Key is present in environment, create real session
    if (STRIPE_SECRET_KEY) {
      try {
        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            mode: 'payment',
            'payment_method_types[0]': 'card',
            customer_email: user.email || '',
            'line_items[0][price_data][currency]': 'gbp',
            'line_items[0][price_data][product_data][name]': `MakeMeClean: ${booking.service_name}`,
            'line_items[0][price_data][product_data][description]': `Clean scheduled on ${booking.date} (${booking.time_slot}) • Invoice ${booking.invoice_number}`,
            'line_items[0][price_data][unit_amount]': amountInPence.toString(),
            'line_items[0][quantity]': '1',
            success_url: successUrl,
            cancel_url: cancelUrl,
            'client_reference_id': booking.id,
            'metadata[booking_id]': booking.id,
            'metadata[user_id]': user.id,
            'metadata[invoice_number]': booking.invoice_number || '',
          }).toString(),
        });

        const session = await stripeRes.json();
        if (!stripeRes.ok || !session.url) {
          return sendError(res, session.error?.message || 'Failed to create Stripe checkout session', 502);
        }

        return sendSuccess(res, {
          sessionId: session.id,
          checkoutUrl: session.url,
          bookingId: booking.id,
          amount: Number(booking.price),
        });
      } catch (stripeErr: any) {
        return sendError(res, stripeErr?.message || 'Stripe API communication failure', 502);
      }
    }

    // Fallback if Stripe Key is configured via Supabase Edge Functions
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('create-stripe-checkout', {
      body: {
        bookingId: booking.id,
        origin: SITE_URL,
      },
    });

    if (!edgeErr && edgeData?.url) {
      return sendSuccess(res, {
        sessionId: edgeData.sessionId || edgeData.id,
        checkoutUrl: edgeData.url,
        bookingId: booking.id,
        amount: Number(booking.price),
      });
    }

    // Direct Stripe payment URL link or fallback
    return sendError(
      res,
      'Stripe payments are currently not configured in server environment variables. Please check STRIPE_SECRET_KEY.',
      503
    );
  } catch (err: any) {
    return sendError(res, err?.message || 'Checkout creation error', 500);
  }
}

