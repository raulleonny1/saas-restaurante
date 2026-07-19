"use client";

import { APP_NAV, MOBILE_NAV_HREFS } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const pathname = usePathname();
  const links = APP_NAV.filter((item) =>
    (MOBILE_NAV_HREFS as readonly string[]).includes(item.href),
  );

  return (
    <nav
      className="sticky bottom-0 z-40 flex border-t border-border bg-bg-elevated/95 px-2 py-2 backdrop-blur md:hidden"
      aria-label="Móvil"
    >
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-[10px] py-2 text-[11px]",
              active ? "text-accent" : "text-fg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
