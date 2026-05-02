import { PropsWithChildren, ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, LayoutDashboard, LogOut, Menu, X, ChevronRight, CalendarCheck, Banknote } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const nav: NavItem[] = [
  { href: "/staff",             label: "My Shifts",      icon: CalendarDays  },
  { href: "/staff/availability",label: "Availability",   icon: CalendarCheck },
  { href: "/staff/payslips",    label: "My Payslips",    icon: Banknote      },
];

function NavLink({ item, current, onClick }: { item: NavItem; current: string; onClick?: () => void }) {
  const [, setLocation] = useLocation();
  const active = current === item.href;
  const Icon = item.icon;
  return (
    <button
      onClick={() => { setLocation(item.href); onClick?.(); }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
        active
          ? "bg-green-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <Icon className={cn("w-5 h-5 shrink-0", active ? "text-white" : "text-gray-400")} />
      <span className="flex-1 text-left">{item.label}</span>
      {active && <ChevronRight className="w-4 h-4 text-white/70" />}
    </button>
  );
}

export default function StaffLayout({
  title,
  subtitle,
  actions,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; actions?: ReactNode }>) {
  const [location, setLocation] = useLocation();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollLock(mobileOpen);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-6 pb-5 border-b border-gray-100">
        <p className="text-xl font-black text-gray-900 tracking-tight">MakeMeClean</p>
        <p className="text-xs text-gray-400 mt-0.5 font-medium">Staff portal</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} current={location} onClick={() => setMobileOpen(false)} />
        ))}
      </nav>

      <div className="px-3 pb-6 border-t border-gray-100 pt-4 space-y-1">
        <button
          onClick={() => setLocation("/dashboard")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <LayoutDashboard className="w-5 h-5 text-gray-400" />
          Customer dashboard
        </button>
        <button
          onClick={async () => { await signOut(); setLocation("/"); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-5 h-5 text-gray-400" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-gray-100 shrink-0 sticky top-0 h-screen overflow-y-auto">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 w-72 h-full bg-white shadow-2xl overflow-y-auto">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-black text-gray-900">MakeMeClean</p>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-5xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
