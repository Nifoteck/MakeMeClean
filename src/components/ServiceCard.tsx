import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Info } from "lucide-react";
import { Service } from "@/lib/services";
import { formatCurrency, cn } from "@/lib/utils";

interface ServiceCardProps {
  service: Service;
  compact?: boolean;
}

export default function ServiceCard({ service, compact = false }: ServiceCardProps) {
  const discount = Math.max(0, Math.min(100, Number(service.discount_percent ?? 0)));
  const hasDiscount = discount > 0;
  const discounted = hasDiscount ? service.price * (1 - discount / 100) : service.price;

  return (
    <div
      className={cn(
        "card-hover group relative flex flex-col bg-white border border-gray-200/90 rounded-3xl transition-all duration-200",
        compact ? "p-4" : "p-5 sm:p-6"
      )}
      data-testid={`card-service-${service.id}`}
    >
      {service.popular && (
        <span className="absolute top-4 right-4 bg-green-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wide uppercase shadow-xs z-10">
          Popular
        </span>
      )}

      {/* Image links to Service Detail */}
      <Link href={`/services/${service.id}`} className="block">
        <div
          className={cn(
            "rounded-2xl overflow-hidden border border-gray-100 mb-4 bg-gray-50 relative",
            compact ? "h-28" : "h-44"
          )}
        >
          {service.image_url ? (
            <img
              src={service.image_url}
              alt={service.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
              Clean Image
            </div>
          )}
        </div>
      </Link>

      {/* Title */}
      <Link href={`/services/${service.id}`}>
        <h3
          className={cn(
            "font-bold text-gray-900 mb-1.5 leading-tight hover:text-green-700 transition-colors cursor-pointer",
            compact ? "text-base" : "text-lg"
          )}
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          {service.name}
        </h3>
      </Link>

      {!compact && (
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">
          {service.description}
        </p>
      )}

      {/* Trust micro-bullets */}
      {!compact && (
        <div className="space-y-1 mb-5 text-[11px] text-gray-600">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span>£2M AXA Insurance · 100% DBS Vetted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <span>Eco-friendly supplies · Free 24h cancellation</span>
          </div>
        </div>
      )}

      {/* Price & Action Buttons */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
        <div>
          <div
            className="text-green-700 font-black text-lg sm:text-xl flex items-baseline gap-1.5"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            {hasDiscount ? (
              <>
                <span>{formatCurrency(discounted)}</span>
                <span className="text-xs text-gray-400 line-through font-bold">
                  {formatCurrency(service.price)}
                </span>
              </>
            ) : (
              <span>{formatCurrency(service.price)}</span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 font-medium">per hour</div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/services/${service.id}`}
            className="text-xs font-semibold text-gray-500 hover:text-green-700 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-green-300 transition-colors hidden sm:inline-flex items-center gap-1"
          >
            <Info className="w-3.5 h-3.5" /> Details
          </Link>
          <Link
            href={`/book/${service.id}`}
            className="btn-primary text-xs py-2 px-4 shadow-sm inline-flex items-center gap-1"
            data-testid={`link-book-${service.id}`}
          >
            Book <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
