import {
  VercelRequest,
  VercelResponse,
  createSupabaseServerClient,
  verifyAuth,
  sendSuccess,
  sendError,
  calcTimeSlot,
  calculateDurationHours,
  generateInvoiceNumber,
  resolveServiceImageUrl,
  getEnv,
} from '../_lib/server.js';

export async function handleBookings(
  req: VercelRequest,
  res: VercelResponse,
  subPath: string,
  params: Record<string, string> = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const auth = await verifyAuth(req);
  if (!auth) {
    return sendError(res, 'Authentication required', 401);
  }

  const { supabase, user } = auth;
  const segments = subPath.split('/').filter(Boolean);

  // ─── 1. /api/bookings (List & Create) ──────────────────────────────────────
  if (segments.length === 0) {
    if (method === 'GET') {
      const statusFilter = (req.query?.status as string) || '';
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'upcoming') {
          query = query.in('status', ['upcoming', 'pending', 'confirmed']);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      const { data, error } = await query;
      if (error) return sendError(res, error.message, 500);

      const items = (data || []).map((b) => ({
        ...b,
        imageUrl: resolveServiceImageUrl(b.service_type, null),
      }));
      return sendSuccess(res, items);
    }

    if (method === 'POST') {
      const body = req.body || {};
      const {
        serviceId,
        date,
        timeSlot: rawTimeSlot,
        startHour,
        durationHours: rawDuration,
        address,
        city,
        postcode,
        notes,
        recurringFreq = 'none',
      } = body;

      if (!serviceId || !date || !address || !postcode) {
        return sendError(res, 'Missing required booking fields (serviceId, date, address, postcode).', 400);
      }

      const { data: service, error: svcErr } = await supabase
        .from('services')
        .select('id, name, price, discount_percent, active')
        .eq('id', serviceId)
        .eq('active', true)
        .single();

      if (svcErr || !service) {
        return sendError(res, 'Selected service is unavailable.', 400);
      }

      let durationHours = typeof rawDuration === 'number' ? rawDuration : 2.0;
      let timeSlot = rawTimeSlot;
      if (!timeSlot && startHour) {
        timeSlot = calcTimeSlot(startHour, durationHours);
      } else if (timeSlot) {
        durationHours = calculateDurationHours(timeSlot);
      } else {
        timeSlot = '09:00 - 11:00';
        durationHours = 2.0;
      }

      durationHours = Math.max(1.5, Math.min(12, durationHours));
      const baseHourlyRate = Number(service.price) || 20.0;
      const basePrice = baseHourlyRate * durationHours;

      let discountPercent = Number(service.discount_percent) || 0;
      let recurringDiscountPercent = 0;

      if (recurringFreq && recurringFreq !== 'none' && recurringFreq !== 'one_off') {
        const { data: settingsData } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', ['discount_weekly', 'discount_biweekly', 'discount_monthly']);

        const settingsMap: Record<string, number> = {};
        for (const s of settingsData || []) {
          settingsMap[s.key] = Number(s.value) || 0;
        }

        if (recurringFreq === 'weekly') recurringDiscountPercent = settingsMap['discount_weekly'] || 15;
        else if (recurringFreq === 'biweekly' || recurringFreq === 'fortnightly') recurringDiscountPercent = settingsMap['discount_biweekly'] || 10;
        else if (recurringFreq === 'monthly') recurringDiscountPercent = settingsMap['discount_monthly'] || 5;
      }

      const totalDiscountPercent = Math.min(50, discountPercent + recurringDiscountPercent);
      const finalPrice = Math.round(basePrice * (1 - totalDiscountPercent / 100) * 100) / 100;
      const invoiceNumber = generateInvoiceNumber();

      const bookingInsert = {
        user_id: user.id,
        service_type: service.id,
        service_name: service.name,
        date,
        time_slot: timeSlot,
        address: address.trim(),
        city: (city || 'South Wales').trim(),
        postcode: postcode.trim().toUpperCase(),
        price: finalPrice,
        status: 'upcoming',
        payment_status: 'pending',
        notes: notes ? String(notes).trim() : null,
        invoice_number: invoiceNumber,
      };

      const { data: booking, error: insertErr } = await supabase
        .from('bookings')
        .insert(bookingInsert)
        .select()
        .single();

      if (insertErr || !booking) {
        return sendError(res, insertErr?.message || 'Failed to create booking', 500);
      }

      if (recurringFreq !== 'none' && recurringFreq !== 'one_off') {
        await supabase.from('recurring_plans').insert({
          user_id: user.id,
          service_type: service.id,
          service_name: service.name,
          frequency: recurringFreq,
          preferred_day: new Date(date).toLocaleDateString('en-GB', { weekday: 'long' }),
          preferred_time: startHour || timeSlot.split(' - ')[0] || '09:00',
          address: address.trim(),
          city: (city || 'South Wales').trim(),
          postcode: postcode.trim().toUpperCase(),
          discount_percent: recurringDiscountPercent,
          price_per_clean: finalPrice,
          status: 'active',
        });
      }

      // Telegram notification
      try {
        const botToken = getEnv('TELEGRAM_BOT_TOKEN');
        const chatId = getEnv('TELEGRAM_ADMIN_CHAT_ID');
        if (botToken && chatId) {
          const msg = `🧹 *New Booking Created*\n*ID:* \`${booking.id}\`\n*Service:* ${service.name}\n*Date:* ${date} (${timeSlot})\n*Address:* ${booking.address}, ${booking.postcode}\n*Price:* £${finalPrice.toFixed(2)}`;
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
          });
        }
      } catch (_) {}

      return sendSuccess(res, { booking }, 201);
    }
  }

  // Booking ID is the first segment
  const bookingId = segments[0] || params.id;
  if (!bookingId) {
    return sendError(res, 'Booking ID is required', 400);
  }

  const action = segments[1] || '';

  // ─── 2. /api/bookings/:id/cancel ───────────────────────────────────────────
  if (action === 'cancel') {
    if (method !== 'POST') return sendError(res, 'Method not allowed', 405);

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, user_id, status, date, time_slot')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);
    if (booking.status === 'cancelled') return sendError(res, 'Booking is already cancelled', 400);

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (updateErr) return sendError(res, updateErr.message, 500);
    return sendSuccess(res, { message: 'Booking cancelled successfully' });
  }

  // ─── 3. /api/bookings/:id/checkout ─────────────────────────────────────────
  if (action === 'checkout') {
    if (method !== 'POST') return sendError(res, 'Method not allowed', 405);

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);

    const siteUrl = getEnv('SITE_URL', 'https://makemeclean.co.uk');
    const successUrl = `${siteUrl}/booking-detail/${booking.id}?payment=success`;
    const cancelUrl = `${siteUrl}/booking-detail/${booking.id}?payment=cancelled`;

    const stripeSecretKey = getEnv('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return sendSuccess(res, {
        checkoutUrl: `${siteUrl}/payment/${booking.id}`,
        mode: 'fallback_web',
      });
    }

    try {
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer_email: user.email || '',
          'client_reference_id': booking.id,
          'metadata[booking_id]': booking.id,
          'metadata[user_id]': user.id,
          'line_items[0][price_data][currency]': 'gbp',
          'line_items[0][price_data][unit_amount]': String(Math.round(booking.price * 100)),
          'line_items[0][price_data][product_data][name]': `MakeMeClean - ${booking.service_name}`,
          'line_items[0][price_data][product_data][description]': `Cleaning on ${booking.date} (${booking.time_slot})`,
          'line_items[0][quantity]': '1',
        }).toString(),
      });

      const session = await stripeRes.json();
      if (!stripeRes.ok || !session.url) {
        return sendSuccess(res, { checkoutUrl: `${siteUrl}/payment/${booking.id}` });
      }
      return sendSuccess(res, { checkoutUrl: session.url, sessionId: session.id });
    } catch (_) {
      return sendSuccess(res, { checkoutUrl: `${siteUrl}/payment/${booking.id}` });
    }
  }

  // ─── 4. /api/bookings/:id/reschedule ───────────────────────────────────────
  if (action === 'reschedule') {
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('reschedule_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data);
    }

    if (method === 'POST') {
      const { requestedDate, requestedTime, reason } = req.body || {};
      if (!requestedDate || !requestedTime) {
        return sendError(res, 'Requested date and time are required', 400);
      }

      const { data, error } = await supabase
        .from('reschedule_requests')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          requested_date: requestedDate,
          requested_time: requestedTime,
          reason: reason ? String(reason).trim() : null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data, 201);
    }
  }

  // ─── 5. /api/bookings/:id/invoice ──────────────────────────────────────────
  if (action === 'invoice') {
    if (method !== 'GET') return sendError(res, 'Method not allowed', 405);

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);

    const netAmount = Math.round((booking.price / 1.2) * 100) / 100;
    const vatAmount = Math.round((booking.price - netAmount) * 100) / 100;

    return sendSuccess(res, {
      invoiceNumber: booking.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`,
      bookingId: booking.id,
      date: booking.date,
      customerName: user.email?.split('@')[0] || 'Valued Customer',
      customerEmail: user.email,
      serviceName: booking.service_name,
      address: booking.address,
      city: booking.city,
      postcode: booking.postcode,
      grossAmount: booking.price,
      netAmount,
      vatAmount,
      currency: 'GBP',
      paymentStatus: booking.payment_status,
      company: {
        name: 'MakeMeClean Ltd',
        country: 'United Kingdom',
        email: 'support@makemeclean.co.uk',
        phone: '+44 7700 900077',
      },
    });
  }

  // ─── 6. /api/bookings/:id/photos ───────────────────────────────────────────
  if (action === 'photos') {
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('booking_photos')
        .select('*')
        .eq('booking_id', bookingId)
        .order('uploaded_at', { ascending: false });

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data || []);
    }

    if (method === 'POST') {
      const { storagePath, photoType = 'after' } = req.body || {};
      if (!storagePath) return sendError(res, 'storagePath is required', 400);

      const { data, error } = await supabase
        .from('booking_photos')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          storage_path: storagePath,
          photo_type: photoType,
        })
        .select()
        .single();

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data, 201);
    }

    if (method === 'DELETE') {
      const { photoId, storagePath } = req.body || {};
      if (!photoId) return sendError(res, 'photoId is required', 400);

      if (storagePath) {
        await supabase.storage.from('booking-photos').remove([storagePath]);
      }
      const { error } = await supabase
        .from('booking_photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', user.id);

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, { message: 'Photo deleted' });
    }
  }

  // ─── 7. /api/bookings/:id/refund ───────────────────────────────────────────
  if (action === 'refund') {
    if (method !== 'POST') return sendError(res, 'Method not allowed', 405);

    const { reason, amount } = req.body || {};
    if (!reason) return sendError(res, 'Refund reason is required', 400);

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('id, user_id, price, status')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);

    const refundAmount = typeof amount === 'number' ? amount : booking.price;

    const { data, error } = await supabase
      .from('refund_requests')
      .insert({
        booking_id: bookingId,
        user_id: user.id,
        reason: String(reason).trim(),
        amount: refundAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return sendError(res, error.message, 500);
    return sendSuccess(res, data, 201);
  }

  // ─── 8. /api/bookings/:id (Get Single Detail) ──────────────────────────────
  if (segments.length === 1 && method === 'GET') {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) return sendError(res, 'Booking not found', 404);
    if (booking.user_id !== user.id) return sendError(res, 'Unauthorized', 403);

    let cleaner = null;
    if (booking.staff_id) {
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, full_name, phone, rating, avatar_url')
        .eq('id', booking.staff_id)
        .maybeSingle();
      cleaner = staffData;
    }

    const { data: reschedule } = await supabase
      .from('reschedule_requests')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: refund } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return sendSuccess(res, {
      ...booking,
      imageUrl: resolveServiceImageUrl(booking.service_type, null),
      cleaner,
      rescheduleRequest: reschedule || null,
      refundRequest: refund || null,
    });
  }

  return sendError(res, 'Endpoint not found', 404);
}

