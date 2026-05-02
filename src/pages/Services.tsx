import { useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { services } from "@/lib/services";
import ServiceCard from "@/components/ServiceCard";

export default function Services() {
  const [search, setSearch] = useState("");

  const filtered = services.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            Our Cleaning Services
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto mb-8">
            Professional cleaning across Wales — from quick standard cleans to full spring cleans. All our cleaners are vetted, insured, and dedicated to quality.
          </p>
          <div className="relative max-w-sm mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
              data-testid="input-service-search"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No services found for "{search}"</p>
            <button onClick={() => setSearch("")} className="mt-3 text-green-600 text-sm hover:underline">Clear search</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>

      {/* Coverage */}
      <div className="bg-green-50 border-t border-green-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Available across Wales</h2>
          <p className="text-gray-500 mb-6">We serve Cardiff, Swansea, Newport, Wrexham, and many more Welsh cities and towns.</p>
          <Link href="/book" className="btn-primary inline-block" data-testid="link-services-book">
            Book a Service
          </Link>
        </div>
      </div>
    </div>
  );
}
