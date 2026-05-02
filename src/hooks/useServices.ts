import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DbService, Service } from "@/lib/services";
import { mapDbService } from "@/lib/services";

const FALLBACK: Service[] = [];

export function useServices() {
  const [services, setServices] = useState<Service[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const { data, error: err } = await supabase
        .from("services")
        .select("id, name, description, price, image_url, discount_percent, popular, active")
        .eq("active", true)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (err) {
        setError(err.message);
        setServices(FALLBACK);
      } else {
        setServices(((data as DbService[]) ?? []).map(mapDbService));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { services, loading, error };
}
