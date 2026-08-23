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

  try {
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, user_id, cleaner_id')
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) {
      return sendError(res, 'Booking not found', 404);
    }

    const isCustomer = booking.user_id === user.id;
    const isCleaner = booking.cleaner_id === user.id;

    if (!isCustomer && !isCleaner) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        return sendError(res, 'You are not authorized to access photos for this booking', 403);
      }
    }

    // ─── GET /api/bookings/:id/photos ───────────────────────────────────────
    if (req.method === 'GET') {
      const { data: photos, error } = await supabase
        .from('clean_photos')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (error) {
        return sendError(res, error.message, 500);
      }

      const beforePhotos = (photos || []).filter((p) => p.photo_type === 'before');
      const afterPhotos = (photos || []).filter((p) => p.photo_type === 'after');

      return sendSuccess(res, {
        all: photos || [],
        before: beforePhotos,
        after: afterPhotos,
      });
    }

    // ─── POST /api/bookings/:id/photos ──────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const photoUrl = (body.photoUrl || body.photo_url || '').trim();
      const photoType = (body.photoType || body.photo_type || 'after').toLowerCase();

      if (!photoUrl) {
        return sendError(res, 'photoUrl is required', 400);
      }

      if (photoType !== 'before' && photoType !== 'after') {
        return sendError(res, 'photoType must be either "before" or "after"', 400);
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('clean_photos')
        .insert({
          booking_id: bookingId,
          photo_url: photoUrl,
          photo_type: photoType,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (insertErr) {
        return sendError(res, insertErr.message, 500);
      }

      return sendSuccess(res, inserted, 201);
    }

    // ─── DELETE /api/bookings/:id/photos ────────────────────────────────────
    if (req.method === 'DELETE') {
      const photoId = (req.query.photoId as string || req.body?.photoId || '').trim();
      if (!photoId) {
        return sendError(res, 'photoId is required', 400);
      }

      const { error: delErr } = await supabase
        .from('clean_photos')
        .delete()
        .eq('id', photoId)
        .eq('booking_id', bookingId);

      if (delErr) {
        return sendError(res, delErr.message, 500);
      }

      return sendSuccess(res, { deleted: true, photoId });
    }

    return sendError(res, 'Method not allowed', 405);
  } catch (err: any) {
    return sendError(res, err?.message || 'Photo endpoint failure', 500);
  }
}

