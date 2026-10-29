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
      try {
        // Try direct supabase client first
        const { data, error: err } = await supabase
          .from("services")
          .select("*")
          .eq("active", true)
          .order("name", { ascending: true });

        if (!err && data && data.length > 0) {
          if (!cancelled) {
            setServices((data as DbService[]).map(mapDbService));
            setLoading(false);
          }
          return;
        }

        // Fallback to /api/services server endpoint if client query returned error or empty
        const apiRes = await fetch("/api/services");
        const apiJson = await apiRes.json();
        if (apiJson && apiJson.ok && Array.isArray(apiJson.data) && apiJson.data.length > 0) {
          if (!cancelled) {
            setServices((apiJson.data as DbService[]).map(mapDbService));
            setLoading(false);
          }
          return;
        }

        if (err && !cancelled) {
          setError(err.message);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load services");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { services, loading, error };
}
