import type { SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "makemeclean_admin_authed_v1";
const SESSION_PASS_KEY = "makemeclean_admin_pass_v1";

export function isAdminAuthed() {
  // We require the session password to be present; otherwise admin-api calls will 401 and look like "0 data".
  // This forces a clean re-auth after a hard refresh/new tab.
  return localStorage.getItem(STORAGE_KEY) === "true" && !!getAdminPassword();
}

export function clearAdminAuth() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_PASS_KEY);
}

export async function adminLogin(supabase: SupabaseClient, password: string) {
  const { data, error } = await supabase.functions.invoke("admin-auth", {
    body: { password },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error("Invalid password");
  localStorage.setItem(STORAGE_KEY, "true");
  sessionStorage.setItem(SESSION_PASS_KEY, password);
}

export function getAdminPassword() {
  return sessionStorage.getItem(SESSION_PASS_KEY) ?? "";
}
