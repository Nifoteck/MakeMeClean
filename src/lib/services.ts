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

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  icon: LucideIcon;
  popular?: boolean;
}

export const services: Service[] = [
  {
    id: "standard-cleaning",
    name: "Standard Cleaning",
    description: "Regular home cleaning covering all main areas — kitchen, bathrooms, living rooms and bedrooms.",
    price: 65,
    duration: "2–3 hours",
    icon: Home,
    popular: true,
  },
  {
    id: "deep-cleaning",
    name: "Deep Cleaning",
    description: "Thorough top-to-bottom clean including inside appliances, skirting boards, and hard-to-reach areas.",
    price: 120,
    duration: "4–6 hours",
    icon: Sparkles,
    popular: true,
  },
  {
    id: "one-off-cleaning",
    name: "One-Off Cleaning",
    description: "A single visit clean — perfect for moving in/out or after a gathering.",
    price: 85,
    duration: "3–4 hours",
    icon: Key,
  },
  {
    id: "same-day-cleaning",
    name: "Same Day Cleaning",
    description: "Need it clean today? Our same-day service gets your home sparkling within hours.",
    price: 95,
    duration: "2–4 hours",
    icon: Zap,
    popular: true,
  },
  {
    id: "airbnb-cleaning",
    name: "Airbnb Cleaning",
    description: "Fast turnaround cleaning between guest stays. Fresh linen, restocking and property check.",
    price: 75,
    duration: "2–3 hours",
    icon: Building2,
  },
  {
    id: "ironing-service",
    name: "Ironing Service",
    description: "Professional ironing and clothes care. Collected, pressed, and returned to you.",
    price: 25,
    duration: "1–2 hours",
    icon: Wind,
  },
  {
    id: "cleaning-and-ironing",
    name: "Cleaning & Ironing",
    description: "The full package — home cleaning combined with professional ironing service.",
    price: 90,
    duration: "3–4 hours",
    icon: Star,
    popular: true,
  },
  {
    id: "window-cleaning",
    name: "Window Cleaning",
    description: "Streak-free interior and exterior window cleaning for your home.",
    price: 40,
    duration: "1–2 hours",
    icon: AppWindow,
  },
  {
    id: "spring-cleaning",
    name: "Spring Cleaning",
    description: "A comprehensive seasonal refresh — declutter, deep clean, and reorganise your entire home.",
    price: 145,
    duration: "6–8 hours",
    icon: Leaf,
  },
  {
    id: "regular-cleaning",
    name: "Regular Cleaning",
    description: "Scheduled weekly or fortnightly cleaning to keep your home consistently spotless.",
    price: 55,
    duration: "2–3 hours",
    icon: CalendarCheck,
    popular: true,
  },
  {
    id: "housekeeping",
    name: "Housekeeping",
    description: "Ongoing housekeeping including laundry, organising, and light cleaning duties.",
    price: 70,
    duration: "3–4 hours",
    icon: BriefcaseBusiness,
  },
];

export const timeSlots = [
  "08:00 – 10:00",
  "09:00 – 11:00",
  "10:00 – 12:00",
  "11:00 – 13:00",
  "12:00 – 14:00",
  "13:00 – 15:00",
  "14:00 – 16:00",
  "15:00 – 17:00",
  "16:00 – 18:00",
];

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
