import { Service } from "@/lib/services";

export interface ServiceCategoryCard {
  id: string;
  name: string;
  badge?: string;
  tagline: string;
  description: string;
  icon: string;
  primaryServiceId: string;
  hourlyRateRange: string;
}

export const CORE_SERVICE_CATEGORIES: ServiceCategoryCard[] = [
  {
    id: "domestic",
    name: "Classic Domestic Cleaning",
    badge: "Most Popular",
    tagline: "Day-to-day routine housekeeping & maintenance",
    description: "Dusting surfaces, vacuuming & mopping floors, sanitising bathrooms & kitchens, making beds, and emptying bins.",
    icon: "🧹",
    primaryServiceId: "standard-cleaning",
    hourlyRateRange: "From £17.00/hr",
  },
  {
    id: "deep",
    name: "Deep Cleaning & Spring Reset",
    badge: "Intensive",
    tagline: "Thorough top-to-bottom scrub for built-up grime",
    description: "Detailed limescale removal, grout scrubbing, skirting boards, door frames, sockets, and behind furniture.",
    icon: "✨",
    primaryServiceId: "deep-cleaning",
    hourlyRateRange: "From £20.00/hr",
  },
  {
    id: "airbnb",
    name: "Holiday Rental & Airbnb Turnover",
    badge: "Host Special",
    tagline: "Fast guest turnovers & staging between stays",
    description: "Complete linen strip & bed dressing, guest amenities check, bathroom shine, kitchen inventory and photo check-in.",
    icon: "🏨",
    primaryServiceId: "airbnb-cleaning",
    hourlyRateRange: "From £20.00/hr",
  },
  {
    id: "ironing",
    name: "Ironing & Laundry Service",
    badge: "Garment Care",
    tagline: "Professional steam pressing, folding & wardrobe care",
    description: "Shirts, trousers, delicates, and bedsheet pressing (~15-20 garments/hr) done neatly in your home.",
    icon: "🧺",
    primaryServiceId: "ironing-service",
    hourlyRateRange: "From £20.00/hr",
  },
  {
    id: "commercial",
    name: "Office & Commercial Cleaning",
    badge: "Business",
    tagline: "Professional cleanliness for workplaces and offices",
    description: "Desks wiped, bin collection & recycling, washrooms sanitised, kitchenettes & meeting room glass buffed.",
    icon: "🏢",
    primaryServiceId: "office-cleaning",
    hourlyRateRange: "From £17.50/hr",
  },
];
