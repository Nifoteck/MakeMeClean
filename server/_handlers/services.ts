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

    function resolveCategory(s: any): string {
      const dbCat = (s.category || '').trim().toLowerCase();
      // If dbCat is set and is not the generic default, or if it specifically matches known categories:
      if (dbCat && !['domestic', ''].includes(dbCat)) return dbCat;
      const id = (s.id || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      if (id.includes('ironing') || name.includes('ironing')) return 'ironing';
      if (id.includes('office') || name.includes('office') || id.includes('commercial') || name.includes('commercial')) return 'commercial';
      if (id.includes('airbnb') || name.includes('airbnb') || id.includes('holiday') || name.includes('holiday')) return 'airbnb';
      if (id.includes('deep') || name.includes('deep') || id.includes('spring') || name.includes('spring')) return 'deep';
      return 'domestic';
    }

    const services = (data || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      price: Number(s.price),
      discount_percent: Number(s.discount_percent || 0),
      popular: Boolean(s.popular),
      active: Boolean(s.active),
      category: resolveCategory(s),
      badge: s.badge || null,
      tagline: s.tagline || null,
      icon: s.icon || null,
      sort_order: typeof s.sort_order === 'number' ? s.sort_order : 0,
      image_url: resolveServiceImageUrl(s.id, s.image_url),
      raw_image_url: s.image_url,
    }));

    return sendSuccess(res, services);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch services', 500);
  }
}

