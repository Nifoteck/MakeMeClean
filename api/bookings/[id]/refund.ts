import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, verifyAuth, sendSuccess, sendError } from '../../_lib/server.js';

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
      .select('id, user_id, price, payment_status')
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.user_id !== user.id) {
      return sendError(res, 'You are not authorized to request a refund for this booking', 403);
    }

    if (booking.payment_status !== 'paid') {
      return sendError(res, 'Refunds can only be requested for paid cleans.', 400);
    }

    const body = req.body || {};
    const reason = (body.reason || '').trim();
    const amount = Number(body.amount || booking.price);

    if (!reason) {
      return sendError(res, 'Please provide a reason for the refund request.', 400);
    }

    if (amount <= 0 || amount > Number(booking.price)) {
      return sendError(res, `Refund amount must be between £1.00 and £${Number(booking.price).toFixed(2)}.`, 400);
    }

    // Check if there is already a pending refund request
    const { data: existing } = await supabase
      .from('refund_requests')
      .select('id, status')
      .eq('booking_id', bookingId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return sendError(res, 'A refund request is already pending review for this clean.', 400);
    }

    const { data: refundRow, error: insertErr } = await supabase
      .from('refund_requests')
      .insert({
        booking_id: bookingId,
        user_id: user.id,
        amount: Math.round(amount * 100) / 100,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr) {
      return sendError(res, insertErr.message, 500);
    }

    return sendSuccess(res, refundRow, 201);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to submit refund request', 500);
  }
}

