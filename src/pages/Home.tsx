import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Star, Shield, Clock, Phone, ArrowRight, Zap, Leaf, Award } from "lucide-react";
import ServiceCard from "@/components/ServiceCard";
import { useServices } from "@/hooks/useServices";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/lib/supabase";

interface Testimonial {
  name: string;
  city: string;
  rating: number;
  text: string;
  service: string;
}

const highlights = [
  { icon: Shield, label: "Fully insured & vetted", desc: "Every cleaner is background-checked, referenced, and insured before they set foot in your home." },
  { icon: Zap, label: "Available same day", desc: "Need it done today? We have cleaners available 7 days a week, often within a few hours." },
  { icon: Leaf, label: "Eco-friendly products", desc: "We only use plant-based cleaning products — safe for kids, pets, and the planet." },
  { icon: Award, label: "Satisfaction guarantee", desc: "If you're not happy, we come back and re-clean at no extra charge. Simple as that." },
];

export default function Home() {
  const settings = useSettings();
  const { services } = useServices();
  const popularServices = services.filter((s) => s.popular).slice(0, 6);

  const [reviewCount, setReviewCount] = useState<number | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    supabase
      .from("reviews")
      .select(`
        overall_rating,
        comments,
        bookings:booking_id ( service_name, city )
      `)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        const mapped: Testimonial[] = (data ?? []).map((r: any) => {
          return {
            name: "Customer",
            city: r.bookings?.city ?? "Wales",
            rating: r.overall_rating ?? 5,
            text: r.comments,
            service: r.bookings?.service_name ?? "Cleaning",
          };
        });
        setTestimonials(mapped);
        setReviewCount(mapped.length);
      });
  }, []);

  return (
    <div className="overflow-x-hidden">

      {/* ── Hero ──────────────────────────────────── */}
      <section className="relative bg-white pt-10 md:pt-16">
        <div className="absolute inset-0 hero-gradient pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center pb-12 md:pb-20">

            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 bg-green-50 border border-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Accepting bookings across Wales
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 leading-[1.05] mb-5">
                Your home,
                <br />
                <span className="text-gradient">spotless</span> — without
                <br />
                the hassle.
              </h1>

              <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8 max-w-md">
                We clean homes in Pontypridd, Cardiff, Newport, Swansea, and everywhere in between. Book in a few taps, trust the result.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link href="/book" className="btn-primary px-7 py-3 text-base">
                  Book a Clean
                </Link>
                <Link href="/services" className="btn-secondary px-7 py-3 text-base">
                  See Prices
                </Link>
              </div>

              <div className="flex items-center gap-4 pt-5 border-t border-gray-100">
                <div className="flex -space-x-2">
                  {["#22c55e","#16a34a","#15803d","#4ade80"].map((c, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: c }}
                    >
                      {["S","J","P","G"][i]}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Fully insured, vetted cleaners — book online in minutes</p>
              </div>
            </div>

            {/* Right — photo */}
            <div className="mt-4 lg:mt-0">
              <div className="rounded-2xl overflow-hidden">
                <img
                  src="/images/home-hero-before.png"
                  alt="Cleaner working in a Welsh home"
                  className="w-full h-64 sm:h-80 lg:h-[500px] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────── */}
      <section className="bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-gray-700/60">
            {[
              { n: reviewCount ? `${reviewCount}+` : "Trusted", label: "Trusted by customers" },
              { n: services.length > 0 ? String(services.length) : "—", label: "Services available" },
              { n: "7 days", label: "A week, 8am – 8pm" },
              { n: "Wales", label: "Fully covered, UK" },
            ].map(({ n, label }) => (
              <div key={label} className="text-center px-4 md:px-6 py-2">
                <div className="text-2xl md:text-3xl font-black text-white">{n}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ──────────────────────────────── */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mb-8 md:mb-12">
            <p className="section-eyebrow">
              <Star className="w-3.5 h-3.5" /> What we do
            </p>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-4">
              The clean your home actually needs
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed">
              From a quick tidy to a proper deep clean — we've got 11 services to pick from, all done by our vetted team.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {popularServices.map((service, i) => (
              <div key={service.id} className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}>
                <ServiceCard service={service} />
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link href="/services" className="btn-secondary inline-flex items-center gap-2">
              All 11 services <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why us ────────────────────────────────── */}
      <section className="py-12 md:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="section-eyebrow"><Shield className="w-3.5 h-3.5" /> Why MakeMeClean</p>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-5">
                We take the boring bit off your plate
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-10">
                Booking a cleaner used to mean word-of-mouth recommendations and crossed fingers. We've built something better — transparent pricing, vetted cleaners, and a simple booking flow that takes two minutes.
              </p>

              <div className="space-y-6">
                {highlights.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 mb-0.5" style={{ fontFamily: "Outfit, sans-serif" }}>{label}</p>
                      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="rounded-2xl overflow-hidden">
                <img
                  src="/images/home-hero-after.png"
                  alt="Cleaner vacuuming a living room floor"
                  className="w-full h-64 sm:h-80 lg:h-[540px] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────── */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <p className="section-eyebrow justify-center"><Clock className="w-3.5 h-3.5" /> Simple booking</p>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">Ready in three steps</h2>
            <p className="text-gray-500 text-lg max-w-md mx-auto">No phone calls, no waiting. Book your clean entirely online in under two minutes.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-5 left-[calc(16.6%+24px)] right-[calc(16.6%+24px)] h-px bg-gray-200" />

            {[
              { n: "01", title: "Pick your service", desc: "Choose from 11 services. Every price is listed upfront — no surprises, no callbacks needed." },
              { n: "02", title: "Choose a time", desc: "Select any available date and time slot, including same day. We work weekends too." },
              { n: "03", title: "We do the rest", desc: "Your cleaner arrives on time, does the job properly, and you pay securely through the app." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="relative text-center">
                <div className="w-11 h-11 rounded-full border-2 border-green-600 flex items-center justify-center mx-auto mb-5 text-green-700 text-sm font-black bg-white relative z-10">
                  {n}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">{desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/book" className="btn-primary px-8 py-3.5 text-base inline-flex items-center gap-2">
              Book now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────── */}
      {testimonials.length >= 3 && (
        <section className="py-12 md:py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
              <div>
                <p className="section-eyebrow"><Star className="w-3.5 h-3.5" /> Customer stories</p>
                <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight">
                  Don't take our
                  <br />word for it
                </h2>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {testimonials.map((t, i) => (
                <div key={i} className="card-hover flex flex-col">
                  <div className="flex text-amber-400 text-sm mb-4">{"★".repeat(t.rating)}</div>
                  <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-5">"{t.text}"</p>
                  <div className="pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
                      >
                        {t.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">{t.name} · {t.city}</p>
                        <p className="text-[10px] text-gray-400">{t.service}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ───────────────────────────────────── */}
      <section className="py-14 md:py-20 green-gradient">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-green-300 text-sm font-semibold uppercase tracking-widest mb-4">Ready when you are</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight">
            Let's get your home clean
          </h2>
          <p className="text-green-100 text-lg mb-10 leading-relaxed">
            Book online in minutes. Available 7 days a week, all across Wales.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/book"
              className="bg-white text-green-700 font-bold px-8 py-3.5 rounded-xl hover:bg-green-50 transition-all duration-150 active:scale-[0.98] shadow-lg text-base inline-flex items-center justify-center gap-2"
            >
              Book a Clean <ArrowRight className="w-4 h-4" />
            </Link>
            {settings.business_phone && (
              <a
                href={`tel:${settings.business_phone.replace(/\s/g, "")}`}
                className="border-2 border-white/40 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-all duration-150 flex items-center gap-2 justify-center text-base"
              >
                <Phone className="w-4 h-4" /> {settings.business_phone}
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
