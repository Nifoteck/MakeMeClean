import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, verifyAuth, sendSuccess, sendError } from '../../_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  const bookingId = (req.query.id as string || '').trim();
  if (!bookingId) {
    return sendError(res, 'Booking ID is required', 400);
  }

  // ─── GET /api/bookings/:id/reschedule ─────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('reschedule_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        return sendError(res, error.message, 500);
      }

      return sendSuccess(res, data && data.length > 0 ? data[0] : null);
    } catch (err: any) {
      return sendError(res, err?.message || 'Failed to fetch reschedule status', 500);
    }
  }

  // ─── POST /api/bookings/:id/reschedule ────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const requestedDate = (body.requestedDate || body.requested_date || '').trim();
      const requestedTime = (body.requestedTime || body.requested_time_slot || body.requestedTimeSlot || '').trim();
      const reason = (body.reason || '').trim();

      if (!requestedDate || !requestedTime) {
        return sendError(res, 'Please provide both requested date and time slot.', 400);
      }

      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select('id, user_id, status, date, time_slot')
        .eq('id', bookingId)
        .single();

      if (bErr || !booking) {
        return sendError(res, 'Booking not found', 404);
      }

      if (booking.user_id !== user.id) {
        return sendError(res, 'You are not authorized to reschedule this booking', 403);
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return sendError(res, `Cannot reschedule a ${booking.status} clean.`, 400);
      }

      const { data: requestRow, error: insertErr } = await supabase
        .from('reschedule_requests')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          original_date: booking.date,
          original_time_slot: booking.time_slot,
          requested_date: requestedDate,
          requested_time_slot: requestedTime,
          reason: reason || null,
          status: 'pending',
        })
        .select()
        .single();

      if (insertErr) {
        return sendError(res, insertErr.message, 500);
      }

      return sendSuccess(res, requestRow, 201);
    } catch (err: any) {
      return sendError(res, err?.message || 'Failed to submit reschedule request', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}

