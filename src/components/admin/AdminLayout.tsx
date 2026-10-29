import type { PropsWithChildren, ReactNode } from "react";
import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  DollarSign,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Repeat,
  Settings,
  SprayCan,
  Trophy,
  UsersRound,
} from "lucide-react";
import PortalLayout, {
  type PortalNavItem,
} from "@/components/layouts/PortalLayout";

const navigation: PortalNavItem[] = [
  { href: "/admin", label: "Bookings", icon: LayoutDashboard },
  { href: "/admin/applicants", label: "Applicants", icon: UsersRound },
  { href: "/admin/staff", label: "Staff", icon: BriefcaseBusiness },
  { href: "/admin/services", label: "Services", icon: SprayCan },
  { href: "/admin/payroll", label: "Payroll", icon: Banknote },
  { href: "/admin/reschedules", label: "Reschedules", icon: CalendarClock },
  { href: "/admin/plans", label: "Plans", icon: Repeat },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare },
  { href: "/admin/refunds", label: "Refunds", icon: DollarSign },
  { href: "/admin/photos", label: "Photos", icon: ImageIcon },
  { href: "/admin/loyalty", label: "Loyalty", icon: Trophy },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({
  title,
  subtitle,
  actions,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}>) {
  return (
    <PortalLayout
      title={title}
      subtitle={subtitle}
      actions={actions}
      portalName="MakeMeClean"
      portalDescription="Back office"
      navigationLabel="Admin navigation"
      homeHref="/"
      homeLabel="View site"
      items={navigation}
      contentWidth="max-w-[1600px]"
    >
      {children}
    </PortalLayout>
  );
}
