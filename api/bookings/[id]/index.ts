import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, verifyAuth, sendSuccess, sendError } from '../../_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
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
      .select('*, staff:cleaner_id(full_name, phone, email)')
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) {
      return sendError(res, 'Booking not found', 404);
    }

    // Check ownership or staff assignment
    if (booking.user_id !== user.id && booking.cleaner_id !== user.id) {
      // Check if user is admin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        return sendError(res, 'You are not authorized to view this booking', 403);
      }
    }

    // Fetch related reschedules, photos, and refund status
    const [rescheduleRes, photosRes, refundRes] = await Promise.all([
      supabase.from('reschedule_requests').select('*').eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(1),
      supabase.from('clean_photos').select('id, photo_url, photo_type, created_at').eq('booking_id', bookingId),
      supabase.from('refund_requests').select('*').eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(1),
    ]);

    return sendSuccess(res, {
      ...booking,
      price: Number(booking.price),
      cleaner_name: booking.staff?.full_name || null,
      cleaner_phone: booking.staff?.phone || null,
      cleaner_email: booking.staff?.email || null,
      active_reschedule: rescheduleRes.data && rescheduleRes.data.length > 0 ? rescheduleRes.data[0] : null,
      photos: photosRes.data || [],
      refund_request: refundRes.data && refundRes.data.length > 0 ? refundRes.data[0] : null,
    });
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch booking detail', 500);
  }
}

