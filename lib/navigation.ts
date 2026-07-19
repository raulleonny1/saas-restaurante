import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Brain,
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

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Module folder under modules/ */
  module: string;
}

/** Single source of truth for app navigation. */
export const APP_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  {
    href: "/admin",
    label: "Admin sala",
    icon: ClipboardList,
    module: "admin",
  },
  { href: "/pos", label: "POS", icon: ShoppingBag, module: "pos" },
  /** Vista sala (dueño); el mesero entra directo a /waiter, no ve este menú. */
  { href: "/waiter", label: "Sala meseros", icon: Smartphone, module: "waiter" },
  { href: "/kitchen", label: "Cocina", icon: ChefHat, module: "kitchen" },
  { href: "/bar", label: "Barra", icon: GlassWater, module: "bar" },
  {
    href: "/inventory?tab=products",
    label: "Carta / Inventario",
    icon: Package,
    module: "inventory",
  },
  { href: "/customers", label: "Clientes", icon: Users, module: "customers" },
  { href: "/reservations", label: "Reservas", icon: CalendarDays, module: "reservations" },
  { href: "/marketing", label: "Marketing", icon: Megaphone, module: "marketing" },
  { href: "/reports", label: "Reportes", icon: BarChart3, module: "reports" },
  { href: "/website", label: "Sitio web", icon: Globe, module: "website" },
  { href: "/ai", label: "IA", icon: Brain, module: "ai" },
  { href: "/employees", label: "Empleados", icon: UsersRound, module: "employees" },
  { href: "/settings", label: "Ajustes", icon: Settings, module: "settings" },
];

export const MOBILE_NAV_HREFS = [
  "/dashboard",
  "/waiter",
  "/pos",
  "/kitchen",
  "/bar",
  "/customers",
] as const;
