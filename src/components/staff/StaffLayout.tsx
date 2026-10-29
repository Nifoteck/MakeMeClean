import type { PropsWithChildren, ReactNode } from "react";
import {
  Banknote,
  CalendarCheck,
  CalendarDays,
  LayoutDashboard,
} from "lucide-react";
import PortalLayout, { type PortalNavItem } from "@/components/layouts/PortalLayout";

const navigation: PortalNavItem[] = [
  { href: "/staff", label: "My Shifts", icon: CalendarDays },
  { href: "/staff/availability", label: "Availability", icon: CalendarCheck },
  { href: "/staff/payslips", label: "My Payslips", icon: Banknote },
];

export default function StaffLayout({
  title,
  subtitle,
  actions,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; actions?: ReactNode }>) {
  return (
    <PortalLayout
      title={title}
      subtitle={subtitle}
      actions={actions}
      portalName="MakeMeClean"
      portalDescription="Staff portal"
      navigationLabel="Staff navigation"
      homeHref="/dashboard"
      homeLabel="Customer dashboard"
      items={navigation}
      contentWidth="max-w-5xl"
    >
      {children}
    </PortalLayout>
  );
}
