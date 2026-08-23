import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, verifyAuth, sendSuccess, sendError } from '../_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'PATCH' && req.method !== 'PUT') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { user, supabase, error: authError } = await verifyAuth(req);
  if (authError || !user) {
    return sendError(res, authError || 'Unauthorized', 401);
  }

  const planId = (req.query.id as string || '').trim();
  if (!planId) {
    return sendError(res, 'Plan ID is required', 400);
  }

  try {
    const { data: plan, error: pErr } = await supabase
      .from('recurring_plans')
      .select('id, user_id, status')
      .eq('id', planId)
      .single();

    if (pErr || !plan) {
      return sendError(res, 'Recurring plan not found', 404);
    }

    if (plan.user_id !== user.id) {
      return sendError(res, 'You are not authorized to modify this plan', 403);
    }

    const body = req.body || {};
    const newStatus = (body.status || '').toLowerCase().trim();

    if (!['active', 'paused', 'cancelled'].includes(newStatus)) {
      return sendError(res, 'Status must be one of: "active", "paused", or "cancelled".', 400);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('recurring_plans')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .select()
      .single();

    if (updateErr) {
      return sendError(res, updateErr.message, 500);
    }

    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to update plan status', 500);
  }
}

