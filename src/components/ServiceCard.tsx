import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
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
        "card-hover group relative flex flex-col",
        compact ? "p-4" : "p-6"
      )}
      data-testid={`card-service-${service.id}`}
    >
      {service.popular && (
        <span className="absolute top-4 right-4 bg-green-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wide uppercase">
          Popular
        </span>
      )}

      <div className={cn("rounded-2xl overflow-hidden border border-gray-100 mb-5 bg-gray-50", compact ? "h-28" : "h-40")}>
        {service.image_url ? (
          <img
            src={service.image_url}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
            Add service image
          </div>
        )}
      </div>

      <h3 className={cn("font-bold text-gray-900 mb-1.5 leading-tight", compact ? "text-base" : "text-lg")}
        style={{ fontFamily: "Outfit, sans-serif" }}>
        {service.name}
      </h3>

      {!compact && (
        <p className="text-sm text-gray-500 leading-relaxed flex-1 mb-5">{service.description}</p>
      )}

      <div className="flex items-center justify-between mt-auto">
        <div>
          <div className="text-green-600 font-black text-xl flex items-baseline gap-2" style={{ fontFamily: "Outfit, sans-serif" }}>
            {hasDiscount ? (
              <>
                <span>{formatCurrency(discounted)}</span>
                <span className="text-sm text-gray-400 line-through font-extrabold">{formatCurrency(service.price)}</span>
              </>
            ) : (
              <span>{formatCurrency(service.price)}</span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">per hour</div>
        </div>
        <Link
          href={`/book/${service.id}`}
          className="flex items-center gap-1 text-sm font-semibold text-green-600 hover:text-green-700 group-hover:gap-2 transition-all duration-150"
          data-testid={`link-book-${service.id}`}
        >
          Book <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
