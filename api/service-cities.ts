import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, getServerSupabase, sendSuccess, sendError } from './_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('service_cities')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      // Fallback to default South Wales cities if table not seeded
      return sendSuccess(res, [
        'Cardiff', 'Swansea', 'Newport', 'Barry', 'Bridgend',
        'Penarth', 'Caerphilly', 'Pontypridd', 'Cwmbran',
        'Llanelli', 'Neath', 'Port Talbot', 'Merthyr Tydfil',
      ]);
    }

    const cities = (data || []).map((c) => c.name);
    return sendSuccess(res, cities.length > 0 ? cities : [
      'Cardiff', 'Swansea', 'Newport', 'Barry', 'Bridgend',
      'Penarth', 'Caerphilly', 'Pontypridd', 'Cwmbran',
      'Llanelli', 'Neath', 'Port Talbot', 'Merthyr Tydfil',
    ]);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch service cities', 500);
  }
}

