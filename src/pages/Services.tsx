import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  Search,
  Shield,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Leaf,
  Layers,
  Home as HomeIcon,
  Building,
  Key,
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import ServiceCard from "@/components/ServiceCard";

const CATEGORIES = [
  { id: "all", label: "All Services", icon: Layers },
  { id: "domestic", label: "Domestic & Deep Clean", icon: HomeIcon },
  { id: "moving", label: "End of Tenancy & Moving", icon: Key },
  { id: "commercial", label: "Commercial & Airbnb", icon: Building },
];

export default function Services() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { services, loading } = useServices();

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedCategory === "all") return true;
      if (selectedCategory === "domestic") {
        return (
          s.name.toLowerCase().includes("domestic") ||
          s.name.toLowerCase().includes("regular") ||
          s.name.toLowerCase().includes("deep") ||
          s.name.toLowerCase().includes("spring") ||
          s.name.toLowerCase().includes("eco")
        );
      }
      if (selectedCategory === "moving") {
        return (
          s.name.toLowerCase().includes("tenancy") ||
          s.name.toLowerCase().includes("move") ||
          s.name.toLowerCase().includes("carpet") ||
          s.name.toLowerCase().includes("after builders")
        );
      }
      if (selectedCategory === "commercial") {
        return (
          s.name.toLowerCase().includes("office") ||
          s.name.toLowerCase().includes("commercial") ||
          s.name.toLowerCase().includes("airbnb") ||
          s.name.toLowerCase().includes("holiday")
        );
      }
      return true;
    });
  }, [services, search, selectedCategory]);

  return (
    <div className="min-h-screen bg-gray-50/70">
      {/* ── Page Hero Header ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 relative">
        <div className="absolute inset-0 hero-gradient pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200/80 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <Sparkles className="w-3.5 h-3.5 text-green-600" />
              Tailored Cleaning Solutions Across Wales
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
              Our Professional Cleaning Services
            </h1>

            <p className="text-gray-600 text-base sm:text-lg mb-8 leading-relaxed">
              Every clean includes DBS-checked cleaners, £2M public liability
              insurance, eco-friendly supplies, and our 100% satisfaction
              re-clean guarantee.
            </p>

            {/* Search Input & Category Filters */}
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search cleaning services (e.g. Tenancy, Deep, Carpet)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  data-testid="input-service-search"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-green-600 text-white shadow-sm"
                          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Trust Reassurance Badges ──────────────────────────────── */}
      <div className="bg-gray-900 text-white py-4 border-b border-gray-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span>£2,000,000 AXA Public Liability Insurance</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>100% DBS-Checked Staff</span>
          </div>
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-400" />
            <span>Non-Toxic Eco-Friendly Products</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-400" />
            <span>Same-Day Availability 7 Days/Week</span>
          </div>
        </div>
      </div>

      {/* ── Services Grid ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-400 font-medium">Loading verified services...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 max-w-lg mx-auto p-8 shadow-xs">
            <p className="text-base font-bold text-gray-900 mb-1">
              No cleaning services found matching "{search}"
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Try searching for "Regular", "Deep clean", or reset your category filters.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedCategory("all");
              }}
              className="btn-primary text-xs py-2 px-4"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>

      {/* ── Standard vs Custom Extras Section ──────────────────────── */}
      <div className="bg-white border-t border-gray-200 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="section-eyebrow">
                <Sparkles className="w-3.5 h-3.5" /> Complete Transparency
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-4">
                What's included in every standard clean
              </h2>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                We believe in straightforward pricing with zero hidden fees. Every standard clean covers all main living areas, kitchen surfaces, bathrooms, and floor care.
              </p>

              <div className="space-y-3">
                {[
                  "All work surfaces, counters & hobs degreased & sanitized",
                  "Complete bathroom scrubbing, limescale removal & disinfection",
                  "Dusting all reachable surfaces, skirting boards & mirrors",
                  "Full vacuuming of carpets, rugs & deep mopping of hard floors",
                  "Emptying bins & disposing of household rubbish",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-700 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 p-6 sm:p-8 rounded-3xl border border-gray-200">
              <h3 className="font-bold text-gray-900 text-base mb-2">
                Popular Optional Extras
              </h3>
              <p className="text-xs text-gray-500 mb-5">
                Add any of these specialist tasks directly inside our booking form:
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Deep Oven & Grill Clean", time: "+ 45 mins" },
                  { name: "Inside Fridge & Freezer", time: "+ 30 mins" },
                  { name: "Interior Window Buffing", time: "+ 30 mins" },
                  { name: "Carpet Stain Extraction", time: "+ 60 mins" },
                  { name: "Inside Kitchen Cabinets", time: "+ 45 mins" },
                  { name: "Ironing & Laundry Service", time: "+ 60 mins" },
                ].map((extra, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-gray-200/80">
                    <div className="font-bold text-xs text-gray-900">{extra.name}</div>
                    <div className="text-[10px] text-green-700 font-semibold">{extra.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Welsh Coverage Banner ─────────────────────────────────── */}
      <div className="green-gradient text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">
            Covering Every Corner of Wales
          </h2>
          <p className="text-green-100 text-sm sm:text-base max-w-xl mx-auto mb-6">
            Serving Cardiff, Newport, Swansea, Pontypridd, Bridgend, Barry, Penarth, Caerphilly, and surrounding areas 7 days a week.
          </p>
          <Link
            href="/book"
            className="bg-white text-green-800 font-bold px-8 py-3.5 rounded-xl hover:bg-green-50 transition-all inline-flex items-center gap-2 text-sm shadow-md"
            data-testid="link-services-book"
          >
            Book Your Cleaner Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
