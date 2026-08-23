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
      .select('id, user_id, status, payment_status, date, time_slot')
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.user_id !== user.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        return sendError(res, 'You do not have permission to cancel this booking', 403);
      }
    }

    if (booking.status === 'completed') {
      return sendError(res, 'Completed cleans cannot be cancelled.', 400);
    }

    if (booking.status === 'cancelled') {
      return sendError(res, 'This booking has already been cancelled.', 400);
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateErr) {
      return sendError(res, updateErr.message, 500);
    }

    return sendSuccess(res, {
      id: bookingId,
      status: 'cancelled',
      message: 'Booking successfully cancelled.',
    });
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to cancel booking', 500);
  }
}

