import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, verifyAuth, sendSuccess, sendError } from '../_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  try {
    const { data: plans, error } = await supabase
      .from('recurring_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return sendError(res, error.message, 500);
    }

    const formattedPlans = (plans || []).map((p) => ({
      id: p.id,
      user_id: p.user_id,
      service_type: p.service_type,
      service_name: p.service_name,
      frequency: p.frequency,
      preferred_day: p.preferred_day,
      preferred_time: p.preferred_time,
      address: p.address,
      city: p.city,
      postcode: p.postcode,
      discount_percent: Number(p.discount_percent || 0),
      price_per_clean: Number(p.price_per_clean || 0),
      status: p.status,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));

    return sendSuccess(res, formattedPlans);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch recurring plans', 500);
  }
}

