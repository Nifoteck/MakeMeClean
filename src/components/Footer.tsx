import { Link } from "wouter";
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter, Briefcase } from "lucide-react";
import logoUrl from "/logo.png";

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">

          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-5">
              <img src={logoUrl} alt="MakeMeClean" className="w-8 h-8 rounded-lg object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="text-lg font-black text-white tracking-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
                MakeMe<span className="text-green-400">Clean</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500 mb-6">
              Trusted cleaning services across Wales. Vetted, insured, and available seven days a week.
            </p>
            <div className="flex gap-2">
              {[
                { icon: Facebook, label: "Facebook" },
                { icon: Instagram, label: "Instagram" },
                { icon: Twitter, label: "Twitter" },
              ].map(({ icon: Icon, label }) => (
                <a key={label} href="#" aria-label={label}
                  className="w-8 h-8 bg-gray-800 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors duration-150">
                  <Icon className="w-3.5 h-3.5 text-gray-300" />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-5">Services</p>
            <ul className="space-y-2.5 text-sm">
              {[
                "Standard Cleaning",
                "Deep Cleaning",
                "Airbnb Cleaning",
                "Window Cleaning",
                "Ironing Service",
                "End of Tenancy",
                "Spring Cleaning",
                "Same Day Cleaning",
              ].map((s) => (
                <li key={s}>
                  <Link href="/services" className="hover:text-green-400 transition-colors duration-100">{s}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-5">Company</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/" className="hover:text-green-400 transition-colors">Home</Link></li>
              <li><Link href="/services" className="hover:text-green-400 transition-colors">All Services</Link></li>
              <li><Link href="/book" className="hover:text-green-400 transition-colors">Book a Clean</Link></li>
              <li>
                <Link href="/careers" className="hover:text-green-400 transition-colors flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3" /> Careers — We're hiring!
                </Link>
              </li>
              <li><Link href="/login" className="hover:text-green-400 transition-colors">Sign In</Link></li>
              <li><Link href="/register" className="hover:text-green-400 transition-colors">Create Account</Link></li>
              <li><a href="#" className="hover:text-green-400 transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-5">Get in Touch</p>
            <ul className="space-y-4 text-sm">
              <li>
                <a href="tel:+447362068202" className="flex items-start gap-3 hover:text-green-400 transition-colors group">
                  <div className="w-7 h-7 bg-gray-800 group-hover:bg-green-600/20 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                    <Phone className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  +44 7362 068202
                </a>
              </li>
              <li>
                <a href="mailto:aadeeniiyii@gmail.com" className="flex items-start gap-3 hover:text-green-400 transition-colors group">
                  <div className="w-7 h-7 bg-gray-800 group-hover:bg-green-600/20 rounded-lg flex items-center justify-center shrink-0 transition-colors">
                    <Mail className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  aadeeniiyii@gmail.com
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <span>Serving all of Wales, UK</span>
                </div>
              </li>
            </ul>
            <div className="mt-6 p-3 bg-green-950/60 border border-green-900/50 rounded-xl">
              <p className="text-xs text-green-300 font-semibold">Available 7 days a week</p>
              <p className="text-xs text-gray-500 mt-0.5">8:00am – 8:00pm</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} MakeMeClean Ltd. All rights reserved.</p>
          <p className="text-xs text-gray-600">Professional cleaning services across Wales, UK</p>
        </div>
      </div>
    </footer>
  );
}
