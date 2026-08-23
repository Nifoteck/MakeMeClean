import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, getServerSupabase, sendSuccess, sendError, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from './_lib/server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const body = req.body || {};
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const phone = (body.phone || '').trim();
    const subject = (body.subject || 'Website Inquiry').trim();
    const message = (body.message || '').trim();

    if (!name || !email || !message) {
      return sendError(res, 'Please provide name, email, and message.', 400);
    }

    const supabase = getServerSupabase();
    const { data: inserted, error } = await supabase
      .from('contact_messages')
      .insert({
        name,
        email,
        phone: phone || null,
        subject,
        message,
        read: false,
      })
      .select()
      .single();

    if (error) {
      return sendError(res, error.message, 500);
    }

    // Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const text =
          `📩 *New Contact Message*\n\n` +
          `• *From:* ${name} (${email})\n` +
          `• *Phone:* ${phone || 'N/A'}\n` +
          `• *Subject:* ${subject}\n\n` +
          `"${message}"`;

        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'Markdown',
          }),
        }).catch(() => {});
      } catch (_) {}
    }

    return sendSuccess(res, {
      message: 'Thank you for reaching out. We have received your inquiry.',
      id: inserted?.id,
    }, 201);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to submit contact message', 500);
  }
}

