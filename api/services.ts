import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, getServerSupabase, sendSuccess, sendError, resolveServiceImageUrl } from './_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('price', { ascending: true });

    if (error) {
      return sendError(res, error.message, 500);
    }

    const services = (data || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      price: Number(s.price),
      discount_percent: Number(s.discount_percent || 0),
      popular: Boolean(s.popular),
      active: Boolean(s.active),
      image_url: resolveServiceImageUrl(s.id, s.image_url),
      raw_image_url: s.image_url,
    }));

    return sendSuccess(res, services);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch services', 500);
  }
}

