import {
  Home,
  Sparkles,
  Key,
  Zap,
  Building2,
  Wind,
  Star,
  AppWindow,
  Leaf,
  CalendarCheck,
  BriefcaseBusiness,
  type LucideIcon,
} from "lucide-react";

export interface DbService {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  icon_key: string;
  popular: boolean | null;
  active: boolean | null;
  sort_order: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  icon: LucideIcon;
  popular?: boolean;
}

export const serviceIcons: Record<string, LucideIcon> = {
  home: Home,
  sparkles: Sparkles,
  key: Key,
  zap: Zap,
  building: Building2,
  wind: Wind,
  star: Star,
  window: AppWindow,
  leaf: Leaf,
  calendar: CalendarCheck,
  briefcase: BriefcaseBusiness,
};

export const defaultIcon: LucideIcon = Home;

export function mapDbService(s: DbService): Service {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    price: Number(s.price),
    duration: s.duration,
    icon: serviceIcons[s.icon_key] ?? defaultIcon,
    popular: Boolean(s.popular),
  };
}

export const HOURLY_RATE = 20;

export const START_HOURS = [
  "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
];

export function calcTimeSlot(startHour: string, durationHours: number): string {
  const [h, m] = startHour.split(":").map(Number);
  const endH = h + durationHours;
  const endStr = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
