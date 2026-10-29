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

/**
 * Builds dynamic service catalog cards directly from database services.
 * Groups services dynamically by their database `category` field.
 * Zero hardcoded fallback lists or synthetic arrays.
 */
export function buildServiceCatalogFromDb(dbServices: Service[]): ServiceCategoryCard[] {
  if (!dbServices || dbServices.length === 0) {
    return [];
  }

  // Filter only active services
  const activeServices = dbServices.filter((s) => s.active !== false);

  // Group services dynamically by category key from DB
  const grouped = new Map<string, Service[]>();
  for (const s of activeServices) {
    const cat = (s.category || s.id || "domestic").trim().toLowerCase();
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(s);
  }

  const cards: ServiceCategoryCard[] = [];

  // Sort categories by lowest sort_order of their services
  const sortedCategories = Array.from(grouped.entries()).sort((a, b) => {
    const minA = Math.min(...a[1].map((s) => (typeof s.sort_order === "number" ? s.sort_order : 999)));
    const minB = Math.min(...b[1].map((s) => (typeof s.sort_order === "number" ? s.sort_order : 999)));
    return minA - minB;
  });

  for (const [catKey, groupServices] of sortedCategories) {
    // Pick the primary service in this category sorted by sort_order
    const sorted = [...groupServices].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const primary = sorted[0];

    const prices = groupServices.map((s) => s.price).filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : (primary?.price || 0);

    const name = primary.name;
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
      hourlyRateRange: minPrice > 0 ? `From £${minPrice.toFixed(2)}/hr` : `£0.00/hr`,
      price: primary.price || minPrice,
      discount_percent: primary.discount_percent,
      services: groupServices,
    });
  }

  return cards;
}
