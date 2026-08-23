import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleCors,
  verifyAuth,
  sendSuccess,
  sendError,
  calcTimeSlot,
  generateInvoiceNumber,
  MIN_DURATION_HOURS,
  MAX_DURATION_HOURS,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from '../_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  // ─── GET /api/bookings ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const status = req.query.status as string | undefined;

      let query = supabase
        .from('bookings')
        .select('*, staff:cleaner_id(full_name, phone, email)')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) {
        return sendError(res, error.message, 500);
      }

      const bookings = (data || []).map((b) => ({
        id: b.id,
        user_id: b.user_id,
        service_type: b.service_type,
        service_name: b.service_name,
        date: b.date,
        time_slot: b.time_slot,
        address: b.address,
        city: b.city,
        postcode: b.postcode,
        price: Number(b.price),
        notes: b.notes,
        status: b.status,
        payment_status: b.payment_status,
        invoice_number: b.invoice_number,
        cleaner_id: b.cleaner_id,
        cleaner_name: b.staff?.full_name || null,
        cleaner_phone: b.staff?.phone || null,
        created_at: b.created_at,
        updated_at: b.updated_at,
      }));

      return sendSuccess(res, bookings);
    } catch (err: any) {
      return sendError(res, err?.message || 'Failed to fetch bookings', 500);
    }
  }

  // ─── POST /api/bookings ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const serviceId = (body.serviceId || body.service_type || body.serviceType || '').trim();
      const date = (body.date || '').trim();
      const startHour = (body.startHour || body.start_hour || '09:00').trim();
      const durationHours = Number(body.durationHours || body.duration_hours || 2.0);
      const address = (body.address || '').trim();
      const city = (body.city || '').trim();
      const postcode = (body.postcode || '').trim().toUpperCase();
      const notes = (body.notes || '').trim();
      const recurringFreq = (body.recurringFreq || body.recurring_freq || 'none').toLowerCase();
      let customTimeSlot = body.timeSlot || body.time_slot;

      if (!serviceId || !date || !address || !postcode) {
        return sendError(res, 'Missing required booking fields (serviceId, date, address, postcode).', 400);
      }

      if (durationHours < MIN_DURATION_HOURS || durationHours > MAX_DURATION_HOURS) {
        return sendError(
          res,
          `Booking duration must be between ${MIN_DURATION_HOURS} and ${MAX_DURATION_HOURS} hours.`,
          400
        );
      }

      // Fetch authentic service details from DB
      const { data: service, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .eq('active', true)
        .single();

      if (svcErr || !service) {
        return sendError(res, 'The selected cleaning service is unavailable or does not exist.', 404);
      }

      // Fetch recurring discount settings from DB
      const { data: settingsData } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['discount_weekly', 'discount_fortnightly', 'discount_monthly']);

      const discountMap: Record<string, number> = {
        weekly: 15,
        fortnightly: 10,
        monthly: 5,
      };

      if (settingsData) {
        for (const row of settingsData) {
          if (row.key === 'discount_weekly') discountMap.weekly = Number(row.value) || 15;
          if (row.key === 'discount_fortnightly') discountMap.fortnightly = Number(row.value) || 10;
          if (row.key === 'discount_monthly') discountMap.monthly = Number(row.value) || 5;
        }
      }

      // Authoritative server-side price calculation
      const baseHourlyPrice = Number(service.price);
      const svcDiscountPercent = Math.max(0, Math.min(100, Number(service.discount_percent || 0)));
      const hourlyPrice = svcDiscountPercent > 0 ? baseHourlyPrice * (1 - svcDiscountPercent / 100) : baseHourlyPrice;
      const totalBeforeRecurring = hourlyPrice * durationHours;

      let recurringDiscountPercent = 0;
      if (recurringFreq === 'weekly') recurringDiscountPercent = discountMap.weekly || 15;
      else if (recurringFreq === 'fortnightly') recurringDiscountPercent = discountMap.fortnightly || 10;
      else if (recurringFreq === 'monthly') recurringDiscountPercent = discountMap.monthly || 5;

      const finalPrice =
        recurringDiscountPercent > 0
          ? totalBeforeRecurring * (1 - recurringDiscountPercent / 100)
          : totalBeforeRecurring;

      const timeSlot = customTimeSlot || calcTimeSlot(startHour, durationHours);
      const invoiceNumber = generateInvoiceNumber();

      // Insert booking record
      const { data: booking, error: insertErr } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          service_type: service.id,
          service_name: service.name,
          date,
          time_slot: timeSlot,
          address,
          city: city || 'South Wales',
          postcode,
          price: Math.round(finalPrice * 100) / 100,
          notes: notes || null,
          status: 'upcoming',
          payment_status: 'pending',
          invoice_number: invoiceNumber,
        })
        .select()
        .single();

      if (insertErr || !booking) {
        return sendError(res, insertErr?.message || 'Failed to create booking', 500);
      }

      // Create recurring subscription plan row if selected
      if (recurringFreq !== 'none' && recurringFreq !== 'one_off') {
        await supabase.from('recurring_plans').insert({
          user_id: user.id,
          service_type: service.id,
          service_name: service.name,
          frequency: recurringFreq,
          preferred_day: new Date(date).toLocaleDateString('en-GB', { weekday: 'long' }),
          preferred_time: startHour,
          address,
          city: city || 'South Wales',
          postcode,
          discount_percent: recurringDiscountPercent,
          price_per_clean: Math.round(finalPrice * 100) / 100,
          status: 'active',
        });
      }

      // Dispatch Telegram booking alert if configured
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        try {
          const text =
            `🧹 *New MakeMeClean Booking*\n\n` +
            `• *Service:* ${service.name}\n` +
            `• *Date & Time:* ${date} (${timeSlot})\n` +
            `• *Amount:* £${(Math.round(finalPrice * 100) / 100).toFixed(2)}\n` +
            `• *Location:* ${city}, ${postcode}\n` +
            `• *Invoice:* \`${invoiceNumber}\`\n` +
            `• *Customer:* ${user.email}`;

          fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text,
              parse_mode: 'Markdown',
            }),
          }).catch(() => {});
        } catch (_) {}
      }

      return sendSuccess(res, {
        booking: {
          id: booking.id,
          service_type: booking.service_type,
          service_name: booking.service_name,
          date: booking.date,
          time_slot: booking.time_slot,
          address: booking.address,
          city: booking.city,
          postcode: booking.postcode,
          price: Number(booking.price),
          notes: booking.notes,
          status: booking.status,
          payment_status: booking.payment_status,
          invoice_number: booking.invoice_number,
          created_at: booking.created_at,
        },
        invoiceNumber,
      }, 201);
    } catch (err: any) {
      return sendError(res, err?.message || 'Failed to process booking', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}

