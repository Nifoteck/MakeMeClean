import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const SETTING_DEFAULTS: Record<string, string> = {
  business_phone:    "+44 7362 068202",
  contact_email:     "aadeeniiyii@gmail.com",
  business_hours:    "7 days a week, 8am–8pm",
  email_info:        "info@makemeclean.co.uk",
  email_recruitment: "recruitment@makemeclean.co.uk",
  email_payment:     "payment@makemeclean.co.uk",
  email_payroll:     "payroll@makemeclean.co.uk",
  email_staffing:    "staffing@makemeclean.co.uk",
};

// Module-level cache so every component shares one fetch per session
let _cache: Record<string, string> | null = null;
let _pending: Promise<Record<string, string>> | null = null;

async function loadSettings(): Promise<Record<string, string>> {
  if (_cache) return _cache;
  if (_pending) return _pending;
  _pending = supabase
    .from("settings")
    .select("key, value")
    .then(({ data }) => {
      const map: Record<string, string> = { ...SETTING_DEFAULTS };
      for (const row of data ?? []) map[row.key] = row.value;
      _cache = map;
      _pending = null;
      return map;
    });
  return _pending;
}

export function invalidateSettingsCache() {
  _cache = null;
  _pending = null;
}

export function useSettings(): Record<string, string> {
  const [settings, setSettings] = useState<Record<string, string>>(SETTING_DEFAULTS);
  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);
  return settings;
}
