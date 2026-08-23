import { VercelRequest, VercelResponse, verifyAuth, sendSuccess, sendError } from '../_lib/server.js';

export async function handleLoyalty(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  try {
    const [{ data: profile, error }, { data: settingRow }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, loyalty_points, created_at')
        .eq('id', user.id)
        .single(),
      supabase
        .from('settings')
        .select('value')
        .eq('key', 'loyalty_enabled')
        .maybeSingle(),
    ]);

    const isEnabled = settingRow?.value === 'true';

    if (error && error.code !== 'PGRST116') {
      return sendError(res, error.message, 500);
    }

    const points = Number(profile?.loyalty_points || 0);

    let tier = 'Bronze';
    let discountPercent = 0;
    let nextTierPoints = 100;
    let nextTierName = 'Silver';
    let progressPercent = (points / 100) * 100;

    if (points >= 500) {
      tier = 'Platinum';
      discountPercent = 20;
      nextTierPoints = 500;
      nextTierName = 'Max Tier';
      progressPercent = 100;
    } else if (points >= 250) {
      tier = 'Gold';
      discountPercent = 15;
      nextTierPoints = 500;
      nextTierName = 'Platinum';
      progressPercent = Math.min(100, Math.round(((points - 250) / 250) * 100));
    } else if (points >= 100) {
      tier = 'Silver';
      discountPercent = 10;
      nextTierPoints = 250;
      nextTierName = 'Gold';
      progressPercent = Math.min(100, Math.round(((points - 100) / 150) * 100));
    }

    return sendSuccess(res, {
      enabled: isEnabled,
      points,
      tier,
      discount_percent: discountPercent,
      next_tier_name: nextTierName,
      next_tier_points: nextTierPoints,
      progress_percent: progressPercent,
      tiers: [
        { name: 'Bronze', min_points: 0, discount_percent: 0, perks: 'Standard loyalty account' },
        { name: 'Silver', min_points: 100, discount_percent: 10, perks: '10% off all cleaning bookings' },
        { name: 'Gold', min_points: 250, discount_percent: 15, perks: '15% off + priority slot allocation' },
        { name: 'Platinum', min_points: 500, discount_percent: 20, perks: '20% VIP discount + free add-on services' },
      ],
    });
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to fetch loyalty status', 500);
  }
}

