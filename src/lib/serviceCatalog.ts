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
  services?: Service[];
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
 * Groups services dynamically by their database `category` field.
 * Any service or category created, edited, or deleted in the admin DB
 * automatically updates here without hardcoded constraints.
 */
export function buildServiceCatalogFromDb(dbServices: Service[]): ServiceCategoryCard[] {
  if (!dbServices || dbServices.length === 0) {
    return FALLBACK_SERVICE_CATEGORIES;
  }

  // Filter only active services
  const activeServices = dbServices.filter((s) => s.popular !== undefined ? true : true);

  // Group services dynamically by category key from DB
  const grouped = new Map<string, Service[]>();
  for (const s of activeServices) {
    const cat = (s.category || "domestic").trim().toLowerCase();
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(s);
  }

  const cards: ServiceCategoryCard[] = [];

  // Sort categories by lowest sort_order of their services
  const sortedCategories = Array.from(grouped.entries()).sort((a, b) => {
    const minA = Math.min(...a[1].map((s) => s.sort_order ?? 999));
    const minB = Math.min(...b[1].map((s) => s.sort_order ?? 999));
    return minA - minB;
  });

  for (const [catKey, groupServices] of sortedCategories) {
    // Pick the primary service in this category (or sort by sort_order / price)
    const sorted = [...groupServices].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const primary = sorted[0];

    const prices = groupServices.map((s) => s.price).filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : (primary?.price || 20);

    const formatCategoryName = (k: string) => {
      if (k === "domestic") return "Classic Domestic Cleaning";
      if (k === "deep") return "Deep Cleaning & Spring Reset";
      if (k === "airbnb") return "Holiday Rental & Airbnb Turnover";
      if (k === "ironing") return "Ironing & Laundry Service";
      if (k === "commercial") return "Office & Commercial Cleaning";
      return k.charAt(0).toUpperCase() + k.slice(1);
    };

    const name = primary.name || formatCategoryName(catKey);
    const badge = primary.badge || (primary.popular ? "Popular" : undefined);
    const tagline = primary.tagline || primary.description || "";
    const description = primary.description || primary.tagline || "";
    const icon = primary.icon || "🧹";

    cards.push({
      id: catKey,
      name,
      badge: badge || undefined,
      tagline,
      description,
      icon,
      primaryServiceId: primary.id,
      hourlyRateRange: `From £${minPrice.toFixed(2)}/hr`,
      price: primary.price || minPrice,
      discount_percent: primary.discount_percent,
      services: groupServices,
    });
  }

  return cards.length > 0 ? cards : FALLBACK_SERVICE_CATEGORIES;
}
