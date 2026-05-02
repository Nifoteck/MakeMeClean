/**
 * Sends a booking notification to a Telegram bot.
 * Requires VITE_TELEGRAM_BOT_TOKEN and VITE_TELEGRAM_CHAT_ID secrets.
 * Add these when ready via Replit Secrets tab.
 */
export async function sendTelegramBookingNotification(booking: {
  id: string;
  service_name: string;
  date: string;
  time_slot: string;
  address: string;
  city: string;
  postcode: string;
  price: number;
  notes?: string | null;
  invoice_number?: string | null;
  customer_email?: string;
}) {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    // Telegram not configured yet — silently skip
    console.info("[MakeMeClean] Telegram not configured. Add VITE_TELEGRAM_BOT_TOKEN and VITE_TELEGRAM_CHAT_ID secrets to enable notifications.");
    return;
  }

  const message = `
🧹 *New Booking — MakeMeClean*

📋 *Service:* ${booking.service_name}
📅 *Date:* ${booking.date}
⏰ *Time:* ${booking.time_slot}
📍 *Address:* ${booking.address}, ${booking.city}, ${booking.postcode}
💷 *Price:* £${booking.price.toFixed(2)}
🧾 *Invoice:* ${booking.invoice_number ?? "N/A"}
${booking.customer_email ? `👤 *Customer:* ${booking.customer_email}` : ""}
${booking.notes ? `📝 *Notes:* ${booking.notes}` : ""}

🆔 Booking ID: \`${booking.id}\`
  `.trim();

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("[MakeMeClean] Telegram notification failed:", err);
  }
}
