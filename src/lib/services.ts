export { calcTimeSlot, START_HOURS } from "../../shared/booking";

export interface DbService {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  discount_percent: number | string | null;
  popular: boolean | null;
  active: boolean | null;
  sort_order?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string | null;
  discount_percent?: number;
  popular?: boolean;
}

export function mapDbService(s: DbService): Service {
  const discount = Number(s.discount_percent ?? 0);
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    price: Number(s.price),
    image_url: s.image_url ?? null,
    discount_percent: Number.isFinite(discount) ? discount : 0,
    popular: Boolean(s.popular),
  };
}

// Service prices are fetched from database per-service, not hardcoded here

export interface ServiceCityLocation {
  id?: string;
  name: string;
  region?: string;
  postcode_prefix?: string;
}

export const walesCities = [
  "Cardiff",
  "Swansea",
  "Newport",
  "Bridgend",
  "Barry",
  "Penarth",
  "Caerphilly",
  "Cwmbran",
  "Pontypridd",
  "Llanelli",
  "Neath",
  "Merthyr Tydfil",
  "Rhondda",
  "Port Talbot",
  "Pontypool",
  "Aberdare",
  "Abergavenny",
];

export async function fetchActiveCities(): Promise<string[]> {
  try {
    const { supabase } = await import("./supabase");
    const { data, error } = await supabase
      .from("service_cities")
      .select("name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((d: any) => d.name);
    }
  } catch (_) {}
  return walesCities;
}

export async function fetchActiveServiceLocations(): Promise<ServiceCityLocation[]> {
  try {
    const { supabase } = await import("./supabase");
    const { data, error } = await supabase
      .from("service_cities")
      .select("id, name, region, postcode_prefix")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (_) {}
  return walesCities.map((c) => ({
    name: c,
    region: "South Wales",
  }));
}

