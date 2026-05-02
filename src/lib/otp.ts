import { supabase } from "@/lib/supabase";

export async function sendOtp(email: string, purpose: "registration" | "careers"): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("send-otp", {
    body: { email, purpose },
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "Failed to send code" };
  return { ok: true };
}

export async function verifyOtp(
  email: string,
  otp: string,
  purpose: "registration" | "careers"
): Promise<{ ok: boolean; verified: boolean; error?: string; reason?: string }> {
  const { data, error } = await supabase.functions.invoke("verify-otp", {
    body: { email, otp, purpose },
  });
  if (error) return { ok: false, verified: false, error: error.message };
  if (!data?.ok) return { ok: false, verified: false, error: data?.error };
  return { ok: true, verified: Boolean(data.verified), reason: data.reason };
}
