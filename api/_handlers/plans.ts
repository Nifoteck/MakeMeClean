import {
  VercelRequest,
  VercelResponse,
  verifyAuth,
  sendSuccess,
  sendError,
} from '../_lib/server.js';

export async function handlePlans(
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
  const planId = segments[0] || params.id;

  if (!planId) {
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('recurring_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) return sendError(res, error.message, 500);
      return sendSuccess(res, data || []);
    }
    return sendError(res, 'Method not allowed', 405);
  }

  if (method === 'PATCH') {
    const { status } = req.body || {};
    if (!['active', 'paused', 'cancelled'].includes(status)) {
      return sendError(res, 'Invalid plan status (must be active, paused, or cancelled)', 400);
    }

    const { data: plan, error: fetchErr } = await supabase
      .from('recurring_plans')
      .select('id, user_id')
      .eq('id', planId)
      .single();

    if (fetchErr || !plan) return sendError(res, 'Plan not found', 404);
    if (plan.user_id !== user.id) return sendError(res, 'Unauthorized', 403);

    const { data: updated, error: updateErr } = await supabase
      .from('recurring_plans')
      .update({ status })
      .eq('id', planId)
      .select()
      .single();

    if (updateErr) return sendError(res, updateErr.message, 500);
    return sendSuccess(res, updated);
  }

  return sendError(res, 'Method not allowed', 405);
}

