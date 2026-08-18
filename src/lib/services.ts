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

// Business hours for booking slots — admin can configure via /admin/settings if needed
// For now, these are standard operating hours (7am–5pm)
export const START_HOURS = [
  "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
];

// Service prices are fetched from database per-service, not hardcoded here

export function calcTimeSlot(startHour: string, durationHours: number): string {
  const [h, m] = startHour.split(":").map(Number);
  const startMins = h * 60 + m;
  const endMins = startMins + Math.round(durationHours * 60);
  const endH = Math.floor(endMins / 60);
  const endM = endMins % 60;
  const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return `${startHour} – ${endStr}`;
}

export const walesCities = [
  "Cardiff",
  "Swansea",
  "Newport",
  "Wrexham",
  "Barry",
  "Neath",
  "Bridgend",
  "Llanelli",
  "Merthyr Tydfil",
  "Caerphilly",
  "Rhondda",
  "Port Talbot",
  "Cwmbran",
  "Pontypool",
  "Aberdare",
  "Pontypridd",
  "Penarth",
  "Colwyn Bay",
  "Abergavenny",
  "Brecon",
];
