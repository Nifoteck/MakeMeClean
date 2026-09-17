import { VercelRequest, VercelResponse, getServerSupabase, sendSuccess, sendError, resolveServiceImageUrl } from '../_lib/server.js';

export async function handleServices(req: VercelRequest, res: VercelResponse) {
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

