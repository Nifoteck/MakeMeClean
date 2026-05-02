import { PropsWithChildren, ReactNode } from "react";
import { useLocation } from "wouter";
import { LayoutDashboard, UsersRound, BriefcaseBusiness, Sparkles, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const nav: NavItem[] = [
  { href: "/admin", label: "Bookings", icon: LayoutDashboard },
  { href: "/admin/applicants", label: "Applicants", icon: UsersRound },
  { href: "/admin/staff", label: "Staff", icon: BriefcaseBusiness },
  { href: "/admin/services", label: "Services", icon: Sparkles },
];

function isActiveRoute(current: string, href: string) {
  if (href === "/admin") return current === "/admin";
  return current === href || current.startsWith(`${href}/`);
}

export default function AdminLayout({
  title,
  subtitle,
  actions,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; actions?: ReactNode }>) {
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <aside className="hidden lg:block">
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm sticky top-6">
              <div className="px-2 py-2 mb-4">
                <p className="text-lg font-black text-gray-900 tracking-tight">MakeMeClean</p>
                <p className="text-xs text-gray-400 mt-0.5">Back office</p>
              </div>
              <nav className="space-y-1">
                {nav.map((i) => {
                  const active = isActiveRoute(location, i.href);
                  const Icon = i.icon;
                  return (
                    <button
                      key={i.href}
                      onClick={() => setLocation(i.href)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all",
                        active
                          ? "bg-green-600 text-white border-green-600 shadow-sm"
                          : "bg-white text-gray-700 border-transparent hover:bg-gray-50 hover:border-gray-100"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", active ? "text-white" : "text-gray-400")} />
                      <span className="flex-1 text-left">{i.label}</span>
                      <ChevronRight className={cn("w-4 h-4", active ? "text-white/80" : "text-gray-300")} />
                    </button>
                  );
                })}
              </nav>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={async () => { await signOut(); setLocation("/"); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <LogOut className="w-4 h-4 text-gray-400" /> Logout
                </button>
              </div>
            </div>
          </aside>

          <section>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
                  {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {actions}
                  <div className="lg:hidden flex gap-2">
                    {nav.map((i) => {
                      const active = isActiveRoute(location, i.href);
                      const Icon = i.icon;
                      return (
                        <button
                          key={i.href}
                          onClick={() => setLocation(i.href)}
                          className={cn(
                            "px-3 py-2 rounded-xl text-sm font-semibold border inline-flex items-center gap-2 shadow-sm",
                            active ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-200"
                          )}
                        >
                          <Icon className={cn("w-4 h-4", active ? "text-white" : "text-gray-400")} />
                          <span className="hidden sm:inline">{i.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}
