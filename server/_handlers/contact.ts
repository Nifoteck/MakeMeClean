import { VercelRequest, VercelResponse, getServerSupabase, sendSuccess, sendError, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../_lib/server.js';

export async function handleContact(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  try {
    const body = req.body || {};
    const readString = (value: unknown) =>
      typeof value === 'string' ? value.trim() : '';
    const name = readString(body.name);
    const email = readString(body.email);
    const phone = readString(body.phone);
    const subject = readString(body.subject) || 'Website Inquiry';
    const message = readString(body.message);

    if (!name || !email || !message) {
      return sendError(res, 'Please provide name, email, and message.', 400);
    }
    if (
      name.length > 160 ||
      email.length > 254 ||
      phone.length > 40 ||
      subject.length > 160 ||
      message.length > 5000
    ) {
      return sendError(res, 'One or more contact fields exceed the allowed length.', 400);
    }

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('contact_messages')
      .insert({
        name,
        email,
        phone: phone || null,
        subject,
        message,
        status: 'new',
      });

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
    }, 201);
  } catch (err: any) {
    return sendError(res, err?.message || 'Failed to submit contact message', 500);
  }
}

