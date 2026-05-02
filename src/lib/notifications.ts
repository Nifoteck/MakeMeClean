import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationEvent =
  | { type: "booking_confirmation"; bookingId: string }
  | { type: "payment_receipt"; bookingId: string }
  | { type: "booking_reminder"; bookingId: string };

export async function sendNotification(supabase: SupabaseClient, event: NotificationEvent) {
  const { error } = await supabase.functions.invoke("notifications", { body: event });
  if (error) throw error;
}

