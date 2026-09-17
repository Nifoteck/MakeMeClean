import { VercelRequest, VercelResponse, sendSuccess, sendError, getEnv } from '../_lib/server.js';

export async function handleConfig(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY');
  const siteUrl = getEnv('SITE_URL', 'https://makemeclean.co.uk').replace(/\/$/, '');

  if (!supabaseUrl || !supabaseAnonKey) {
    return sendError(res, 'Backend credentials not configured in environment variables.', 500);
  }

  return sendSuccess(res, {
    apiVersion: '2.2.0',
    siteUrl,
    supabaseUrl,
    supabaseAnonKey,
  });
}

