"use client";

import { useAuth } from "@/context/AuthProvider";
import { cn } from "@/lib/cn";
import { filterAppNav } from "@/lib/navigation";
import { homePathForRole } from "@/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const { can, role } = useAuth();
  const links = filterAppNav(can);
  const home = homePathForRole(role);

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-bg-elevated/80 px-3 py-5 backdrop-blur md:flex md:flex-col">
      <div className="mb-6 px-2">
        <Link href={home} className="block">
          <p className="text-title">SmartServe</p>
          <p className="text-xs text-fg-muted">
            {role === "cocinero"
              ? "Cocina"
              : role === "barista"
                ? "Barra"
                : "Restaurant OS"}
          </p>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5" aria-label="Principal">
        {links.map((link) => {
          const pathOnly = link.href.split("?")[0] ?? link.href;
          const active =
            pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm transition",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-fg-muted hover:bg-bg-muted hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
