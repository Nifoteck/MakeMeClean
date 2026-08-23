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
    const [bookingRes, profileRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', bookingId).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ]);

    const booking = bookingRes.data;
    if (bookingRes.error || !booking) {
      return sendError(res, 'Booking not found', 404);
    }

    if (booking.user_id !== user.id) {
      const { data: adminCheck } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (adminCheck?.role !== 'admin') {
        return sendError(res, 'You are not authorized to access this invoice', 403);
      }
    }

    const profile = profileRes.data || {};
    const totalPrice = Number(booking.price);

    const invoiceData = {
      invoice_number: booking.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`,
      issue_date: booking.created_at || new Date().toISOString(),
      due_date: booking.date,
      payment_status: booking.payment_status || 'pending',
      currency: 'GBP',
      symbol: '£',
      company: {
        name: 'MakeMeClean Ltd',
        tagline: 'Premium Cleaning Services Across South Wales',
        address: 'Cardiff & South Wales Region, United Kingdom',
        phone: '+44 7362 068202',
        email: 'contact@makemeclean.co.uk',
        website: 'https://makemeclean.co.uk',
      },
      customer: {
        name: profile.full_name || user.email?.split('@')[0] || 'Valued Customer',
        email: profile.email || user.email,
        phone: profile.phone || null,
        address: booking.address,
        city: booking.city,
        postcode: booking.postcode,
      },
      items: [
        {
          description: `${booking.service_name} (${booking.time_slot})`,
          service_type: booking.service_type,
          service_date: booking.date,
          amount: totalPrice,
        },
      ],
      subtotal: totalPrice,
      vat: 0.0,
      total: totalPrice,
      notes: booking.notes || 'Thank you for choosing MakeMeClean. For inquiries or adjustments, contact contact@makemeclean.co.uk.',
    };

    return sendSuccess(res, invoiceData);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to generate invoice', 500);
  }
}

