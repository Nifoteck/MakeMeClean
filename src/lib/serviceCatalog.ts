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
  price?: number;
  discount_percent?: number;
}

export const FALLBACK_SERVICE_CATEGORIES: ServiceCategoryCard[] = [
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

export const CORE_SERVICE_CATEGORIES = FALLBACK_SERVICE_CATEGORIES;

/**
 * Builds dynamic service catalog cards using live database services.
 * Groups services by category or maps primary services so any update
 * by an admin in Supabase instantly reflects on the frontend.
 */
export function buildServiceCatalogFromDb(dbServices: Service[]): ServiceCategoryCard[] {
  if (!dbServices || dbServices.length === 0) {
    return FALLBACK_SERVICE_CATEGORIES;
  }

  // Pre-defined category descriptors to keep consistent category grouping
  const categoryOrder = ["domestic", "deep", "airbnb", "ironing", "commercial"];
  const categoryMeta: Record<string, { name: string; tagline: string; icon: string; badge?: string; primaryId: string }> = {
    domestic: {
      name: "Classic Domestic Cleaning",
      tagline: "Day-to-day routine housekeeping & maintenance",
      icon: "🧹",
      badge: "Most Popular",
      primaryId: "standard-cleaning",
    },
    deep: {
      name: "Deep Cleaning & Spring Reset",
      tagline: "Thorough top-to-bottom scrub for built-up grime",
      icon: "✨",
      badge: "Intensive",
      primaryId: "deep-cleaning",
    },
    airbnb: {
      name: "Holiday Rental & Airbnb Turnover",
      tagline: "Fast guest turnovers & staging between stays",
      icon: "🏨",
      badge: "Host Special",
      primaryId: "airbnb-cleaning",
    },
    ironing: {
      name: "Ironing & Laundry Service",
      tagline: "Professional steam pressing, folding & wardrobe care",
      icon: "🧺",
      badge: "Garment Care",
      primaryId: "ironing-service",
    },
    commercial: {
      name: "Office & Commercial Cleaning",
      tagline: "Professional cleanliness for workplaces and offices",
      icon: "🏢",
      badge: "Business",
      primaryId: "office-cleaning",
    },
  };

  const cards: ServiceCategoryCard[] = [];

  categoryOrder.forEach((catKey) => {
    // Find matching services belonging to this category
    const catServices = dbServices.filter(
      (s) => (s.category && s.category.toLowerCase() === catKey) ||
             (catKey === "domestic" && (!s.category || s.category === "domestic"))
    );

    const meta = categoryMeta[catKey];
    if (!meta) return;

    // Pick primary service if exists, or first in category
    const primaryService = catServices.find((s) => s.id === meta.primaryId) || catServices[0] || dbServices.find((s) => s.id === meta.primaryId);

    // Calculate minimum price among active services in this category
    const prices = catServices.length > 0 ? catServices.map((s) => s.price).filter((p) => p > 0) : [20];
    const minPrice = prices.length > 0 ? Math.min(...prices) : (primaryService?.price || 20);

    // If service has DB custom badge/tagline/icon, respect admin overrides
    const badge = primaryService?.badge || meta.badge;
    const tagline = primaryService?.tagline || meta.tagline;
    const icon = primaryService?.icon || meta.icon;
    const name = primaryService?.name && catServices.length === 1 ? primaryService.name : meta.name;
    const description = primaryService?.description || "";

    cards.push({
      id: catKey,
      name,
      badge: badge || undefined,
      tagline,
      description: description || meta.tagline,
      icon,
      primaryServiceId: primaryService?.id || meta.primaryId,
      hourlyRateRange: `From £${minPrice.toFixed(2)}/hr`,
      price: primaryService?.price || minPrice,
      discount_percent: primaryService?.discount_percent,
    });
  });

  return cards;
}
