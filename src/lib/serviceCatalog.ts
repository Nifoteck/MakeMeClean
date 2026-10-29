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

function resolveServiceCategory(s: Service): string {
  if (s.category && s.category.trim() !== "") {
    return s.category.trim().toLowerCase();
  }

  const id = (s.id || "").toLowerCase();
  const name = (s.name || "").toLowerCase();

  if (id.includes("ironing") || name.includes("ironing")) return "ironing";
  if (id.includes("office") || name.includes("office") || id.includes("commercial") || name.includes("commercial")) return "commercial";
  if (id.includes("airbnb") || name.includes("airbnb") || id.includes("holiday") || name.includes("holiday")) return "airbnb";
  if (id.includes("deep") || name.includes("deep") || id.includes("spring") || name.includes("spring")) return "deep";
  return "domestic";
}

function resolveServiceIcon(s: Service, catKey: string): string {
  if (s.icon && s.icon.trim() !== "") return s.icon;
  if (catKey === "deep") return "✨";
  if (catKey === "airbnb") return "🏨";
  if (catKey === "ironing") return "🧺";
  if (catKey === "commercial") return "🏢";
  return "🧹";
}

function resolveCategoryName(catKey: string, primary: Service): string {
  if (catKey === "domestic") return "Classic Domestic Cleaning";
  if (catKey === "deep") return "Deep Cleaning & Spring Reset";
  if (catKey === "airbnb") return "Holiday Rental & Airbnb Turnover";
  if (catKey === "ironing") return "Ironing & Laundry Service";
  if (catKey === "commercial") return "Office & Commercial Cleaning";
  return primary.name || catKey.charAt(0).toUpperCase() + catKey.slice(1);
}

/**
 * Builds dynamic service catalog cards directly from database services.
 * Groups services dynamically by category so every single active service
 * in the database is represented without hardcoding or missing items.
 */
export function buildServiceCatalogFromDb(dbServices: Service[]): ServiceCategoryCard[] {
  if (!dbServices || dbServices.length === 0) {
    return [];
  }

  // Filter active services
  const activeServices = dbServices.filter((s) => s.active !== false);

  // Group services by category
  const grouped = new Map<string, Service[]>();
  for (const s of activeServices) {
    const cat = resolveServiceCategory(s);
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(s);
  }

  const cards: ServiceCategoryCard[] = [];

  // Consistent order: domestic, deep, airbnb, ironing, commercial, then any custom categories
  const preferredOrder = ["domestic", "deep", "airbnb", "ironing", "commercial"];
  const sortedCategories = Array.from(grouped.entries()).sort((a, b) => {
    const idxA = preferredOrder.indexOf(a[0]);
    const idxB = preferredOrder.indexOf(b[0]);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [catKey, groupServices] of sortedCategories) {
    // Pick the primary service in this category sorted by sort_order or lowest price
    const sorted = [...groupServices].sort((a, b) => {
      const soA = typeof a.sort_order === "number" ? a.sort_order : 999;
      const soB = typeof b.sort_order === "number" ? b.sort_order : 999;
      if (soA !== soB) return soA - soB;
      return a.price - b.price;
    });
    const primary = sorted[0];

    const prices = groupServices.map((s) => s.price).filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : (primary?.price || 0);

    const name = resolveCategoryName(catKey, primary);
    const badge = primary.badge || (primary.popular ? "Popular" : undefined);
    const tagline = primary.tagline || primary.description || "";
    const description = primary.description || primary.tagline || "";
    const icon = resolveServiceIcon(primary, catKey);

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
