import { VercelRequest, VercelResponse, getServerSupabase, sendSuccess, sendError } from '../_lib/server.js';

export async function handleServiceCities(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  const defaultCities = [
    'Cardiff', 'Swansea', 'Newport', 'Barry', 'Bridgend',
    'Penarth', 'Caerphilly', 'Pontypridd', 'Cwmbran',
    'Llanelli', 'Neath', 'Port Talbot', 'Merthyr Tydfil',
  ];

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('service_cities')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      return sendSuccess(res, defaultCities);
    }

    const cities = (data || []).map((c) => c.name);
    return sendSuccess(res, cities.length > 0 ? cities : defaultCities);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch service cities', 500);
  }
}

