import {
  VercelRequest,
  VercelResponse,
  verifyAuth,
  sendSuccess,
  sendError,
  resolveServiceImageUrl,
} from '../_lib/server.js';

export async function handleDashboard(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  try {
    const [profileRes, bookingsRes, servicesRes, notifsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('bookings')
        .select('*, staff:cleaner_id(full_name, phone)')
        .eq('user_id', user.id)
        .order('date', { ascending: false }),
      supabase.from('services').select('*').eq('active', true).order('price', { ascending: true }),
      supabase.from('notifications').select('id, title, message, read, created_at').eq('user_id', user.id).eq('read', false),
    ]);

    const bookings = bookingsRes.data || [];
    const counts = {
      total: bookings.length,
      upcoming: bookings.filter((b) => b.status === 'upcoming').length,
      in_progress: bookings.filter((b) => b.status === 'in_progress').length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
    };

    const recentBookings = bookings.slice(0, 4).map((b) => ({
      id: b.id,
      service_type: b.service_type,
      service_name: b.service_name,
      date: b.date,
      time_slot: b.time_slot,
      price: Number(b.price),
      status: b.status,
      payment_status: b.payment_status,
      invoice_number: b.invoice_number,
      address: b.address,
      city: b.city,
      postcode: b.postcode,
      cleaner_id: b.cleaner_id,
      cleaner_name: b.staff?.full_name || null,
      created_at: b.created_at,
    }));

    const services = (servicesRes.data || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      price: Number(s.price),
      discount_percent: Number(s.discount_percent || 0),
      popular: Boolean(s.popular),
      active: Boolean(s.active),
      image_url: resolveServiceImageUrl(s.id, s.image_url),
    }));

    const profile = profileRes.data || {
      id: user.id,
      email: user.email,
      full_name: user.email?.split('@')[0] || 'Customer',
      loyalty_points: 0,
    };

    const points = Number(profile.loyalty_points || 0);
    let tier = 'Bronze';
    let discountPercent = 0;
    let nextTierPoints = 100;

    if (points >= 500) {
      tier = 'Platinum';
      discountPercent = 20;
      nextTierPoints = 500;
    } else if (points >= 250) {
      tier = 'Gold';
      discountPercent = 15;
      nextTierPoints = 500;
    } else if (points >= 100) {
      tier = 'Silver';
      discountPercent = 10;
      nextTierPoints = 250;
    }

    return sendSuccess(res, {
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email || user.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        postcode: profile.postcode,
        loyalty_points: points,
        created_at: profile.created_at,
      },
      counts,
      recent_bookings: recentBookings,
      services,
      loyalty: {
        points,
        tier,
        discount_percent: discountPercent,
        next_tier_points: nextTierPoints,
      },
      unread_notifications_count: notifsRes.data ? notifsRes.data.length : 0,
    });
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch dashboard data', 500);
  }
}

