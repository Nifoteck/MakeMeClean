import { VercelRequest, VercelResponse, sendSuccess, sendError, SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL } from '../_lib/server.js';

export async function handleConfig(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return sendError(res, 'Backend credentials not configured in environment variables.', 500);
  }

  return sendSuccess(res, {
    apiVersion: '2.2.0',
    siteUrl: SITE_URL,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
  });
}

