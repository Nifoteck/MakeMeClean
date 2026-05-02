import { Link } from "wouter";
import { Clock, ArrowRight } from "lucide-react";
import { Service } from "@/lib/services";
import { formatCurrency, cn } from "@/lib/utils";

interface ServiceCardProps {
  service: Service;
  compact?: boolean;
}

export default function ServiceCard({ service, compact = false }: ServiceCardProps) {
  const Icon = service.icon;

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

      <div className={cn(
        "bg-green-50 border border-green-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-green-100 group-hover:border-green-200 transition-all duration-200",
        compact ? "w-10 h-10 mb-3" : "w-12 h-12"
      )}>
        <Icon className={cn("text-green-600", compact ? "w-5 h-5" : "w-6 h-6")} />
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
          <div className="text-green-600 font-black text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>
            {formatCurrency(service.price)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <Clock className="w-3 h-3" /> {service.duration}
          </div>
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
