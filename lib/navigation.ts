import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  Brain,
  Building2,
  CalendarDays,
  ChefHat,
  ClipboardList,
  GlassWater,
  Globe,
  LayoutDashboard,
  Megaphone,
  Package,
  Settings,
  ShoppingBag,
  Smartphone,
  Users,
  UsersRound,
} from "lucide-react";
import type { PermissionId } from "@/types/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Module folder under modules/ */
  module: string;
  /** Mostrar si el usuario tiene CUALQUIERA de estos permisos. */
  anyOf?: PermissionId[];
  /** Incluir en la barra inferior móvil (tras filtrar por permiso). */
  mobile?: boolean;
}

/** Single source of truth for app navigation. */
export const APP_NAV: NavItem[] = [
  {
    href: "/superadmin",
    label: "Clientes",
    icon: Building2,
    module: "platform",
    anyOf: ["platform.tenants.read", "platform.tenants.manage"],
    mobile: true,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    module: "dashboard",
    anyOf: ["reports.read"],
    mobile: true,
  },
  {
    href: "/admin",
    label: "Admin sala",
    icon: ClipboardList,
    module: "admin",
    anyOf: ["employees.read", "tables.manage"],
  },
  {
    href: "/pos",
    label: "POS",
    icon: ShoppingBag,
    module: "pos",
    anyOf: ["pos.access"],
    mobile: true,
  },
  {
    href: "/waiter",
    label: "Sala meseros",
    icon: Smartphone,
    module: "waiter",
    anyOf: ["pos.access"],
    mobile: true,
  },
  {
    href: "/caja",
    label: "Caja",
    icon: Banknote,
    module: "pos",
    anyOf: ["payments.charge", "payments.cash_drawer"],
    mobile: true,
  },
  {
    href: "/kitchen",
    label: "Cocina",
    icon: ChefHat,
    module: "kitchen",
    anyOf: ["kitchen.access"],
    mobile: true,
  },
  {
    href: "/bar",
    label: "Barra",
    icon: GlassWater,
    module: "bar",
    anyOf: ["bar.access"],
    mobile: true,
  },
  {
    href: "/inventory?tab=products",
    label: "Carta",
    icon: Package,
    module: "inventory",
    anyOf: ["catalog.read", "inventory.read"],
    mobile: true,
  },
  {
    href: "/customers",
    label: "Clientes",
    icon: Users,
    module: "customers",
    anyOf: ["customers.read"],
  },
  {
    href: "/reservations",
    label: "Reservas",
    icon: CalendarDays,
    module: "reservations",
    anyOf: ["reservations.read"],
  },
  {
    href: "/marketing",
    label: "Marketing",
    icon: Megaphone,
    module: "marketing",
    anyOf: ["marketing.read"],
  },
  {
    href: "/reports",
    label: "Reportes",
    icon: BarChart3,
    module: "reports",
    anyOf: ["reports.read"],
  },
  {
    href: "/website",
    label: "Sitio web",
    icon: Globe,
    module: "website",
    anyOf: ["website.read"],
  },
  {
    href: "/ai",
    label: "IA",
    icon: Brain,
    module: "ai",
    anyOf: ["ai.assistant"],
  },
  {
    href: "/employees",
    label: "Empleados",
    icon: UsersRound,
    module: "employees",
    anyOf: ["employees.read"],
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: Settings,
    module: "settings",
    anyOf: ["settings.read"],
  },
];

export function navItemVisible(
  item: NavItem,
  can: (permission: PermissionId) => boolean,
): boolean {
  if (!item.anyOf?.length) return true;
  return item.anyOf.some((p) => can(p));
}

export function filterAppNav(
  can: (permission: PermissionId) => boolean,
  opts?: { mobileOnly?: boolean; /** Solo menú de plataforma (alta de clientes) */ platformOnly?: boolean },
): NavItem[] {
  return APP_NAV.filter((item) => {
    if (opts?.platformOnly) return item.module === "platform";
    if (opts?.mobileOnly && !item.mobile) return false;
    return navItemVisible(item, can);
  });
}
