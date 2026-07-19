"use client";

import { usePublicSite } from "@/modules/website/context/PublicSiteProvider";
import { publicSitePath } from "@/modules/website/domain/slug";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV: Array<{
  href: string;
  label: string;
  section: Parameters<ReturnType<typeof usePublicSite>["sectionEnabled"]>[0];
}> = [
  { href: "/menu", label: "Menú", section: "menu" },
  { href: "/pedir", label: "Pedidos", section: "orders" },
  { href: "/reservas", label: "Reservas", section: "reservations" },
  { href: "/promociones", label: "Promociones", section: "promotions" },
  { href: "/blog", label: "Blog", section: "blog" },
  { href: "/eventos", label: "Eventos", section: "events" },
  { href: "/opiniones", label: "Opiniones", section: "reviews" },
  { href: "/ubicacion", label: "Ubicación", section: "location" },
];

export function PublicSiteShell({ children }: { children: ReactNode }) {
  const { ready, error, restaurant, settings, slug, sectionEnabled, cart } =
    usePublicSite();
  const pathname = usePathname();
  const accent = settings?.accentColor || "var(--accent)";

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1410] text-[#e8efe6]">
        Cargando sitio…
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f1410] px-6 text-center text-[#e8efe6]">
        <p className="font-[family-name:var(--font-display)] text-3xl">
          Este local aún no tiene página
        </p>
        <p className="max-w-md text-sm leading-relaxed text-[#a8b5a4]">
          {error ??
            "El enlace no existe. Entra como dueño a Sitio web, pulsa «Guardar y publicar» y usa el enlace que te aparece ahí (no inventes el slug)."}
        </p>
        <Link
          href="/website"
          className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Ir a Sitio web (admin)
        </Link>
        <p className="max-w-sm text-xs text-[#6b7a68]">
          Ejemplo correcto: /r/tu-slug-real · Si escribiste /r/mi-bar a mano y
          no lo guardaste en admin, no funcionará.
        </p>
      </div>
    );
  }

  const isHome = pathname === publicSitePath(slug) || pathname === `/r/${slug}`;

  return (
    <div
      className="min-h-screen bg-[#0f1410] text-[#e8efe6]"
      style={{ ["--site-accent" as string]: accent }}
    >
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f1410]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href={publicSitePath(slug)}
            className="font-[family-name:var(--font-display)] text-xl tracking-tight sm:text-2xl"
          >
            {restaurant.name}
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.filter((n) => sectionEnabled(n.section)).map((n) => {
              const href = publicSitePath(slug, n.href);
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={n.href}
                  href={href}
                  className={`rounded-md px-2.5 py-1.5 text-sm transition ${
                    active
                      ? "bg-[var(--site-accent)] text-white"
                      : "text-[#c5d0c2] hover:text-white"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {sectionEnabled("reservations") ? (
              <Link
                href={publicSitePath(slug, "/reservas")}
                className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-[#c5d0c2] hover:text-white"
              >
                Reservar
              </Link>
            ) : null}
            {sectionEnabled("orders") ? (
              <Link
                href={publicSitePath(slug, "/pedir")}
                className="rounded-md bg-[var(--site-accent)] px-3 py-1.5 text-sm font-medium text-white"
              >
                Pedir{cart.length ? ` (${cart.length})` : ""}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {NAV.filter((n) => sectionEnabled(n.section)).map((n) => (
            <Link
              key={n.href}
              href={publicSitePath(slug, n.href)}
              className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-[#c5d0c2]"
            >
              {n.label}
            </Link>
          ))}
        </div>
      </header>

      {isHome ? (
        <section className="relative min-h-[78vh] overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,20,16,0.25), rgba(15,20,16,0.92)), url('${
                settings?.heroImageUrl ||
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2000&q=80"
              }')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6">
            <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight sm:text-7xl">
              {restaurant.name}
            </p>
            <p className="mt-4 max-w-lg text-lg text-[#d5dfd2]">
              {settings?.tagline || "Carta, reservas y pedidos online."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#carta"
                className="rounded-md bg-[var(--site-accent)] px-5 py-2.5 text-sm font-medium text-white"
              >
                Ver la carta
              </a>
              {sectionEnabled("reservations") ? (
                <Link
                  href={publicSitePath(slug, "/reservas")}
                  className="rounded-md border border-white/25 px-5 py-2.5 text-sm font-medium text-white"
                >
                  Reservar mesa
                </Link>
              ) : null}
              {sectionEnabled("orders") ? (
                <Link
                  href={publicSitePath(slug, "/pedir")}
                  className="rounded-md border border-white/25 px-5 py-2.5 text-sm font-medium text-white"
                >
                  Pedir para llevar
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>

      <footer className="border-t border-white/10 px-4 py-8 text-sm text-[#8fa08c] sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {restaurant.name}
            {restaurant.address ? ` · ${restaurant.address}` : ""}
          </p>
          <p>Powered by SmartServe · {restaurant.currency}</p>
        </div>
      </footer>
    </div>
  );
}
