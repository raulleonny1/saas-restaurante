"use client";

import { APP_NAV } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-bg-elevated/80 px-4 py-6 backdrop-blur md:flex md:flex-col">
      <div className="mb-8 px-2">
        <p className="text-title">SmartServe</p>
        <p className="text-xs text-fg-muted">AI Restaurant OS</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Principal">
        {APP_NAV.map((link) => {
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
