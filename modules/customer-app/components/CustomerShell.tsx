"use client";

import { useAuth } from "@/context/AuthProvider";
import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

const TABS = [
  { href: "", label: "Inicio", match: "exact" as const },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/seguimiento", label: "Seguimiento" },
  { href: "/reservas", label: "Reservas" },
  { href: "/puntos", label: "Puntos" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/historial", label: "Historial" },
  { href: "/promociones", label: "Promos" },
  { href: "/chat", label: "Chat" },
  { href: "/notificaciones", label: "Avisos" },
];

export function CustomerShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { ready, error, restaurant, slug, notifications } = useCustomerApp();
  const pathname = usePathname();
  const base = `/c/${slug}`;
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (slug && typeof window !== "undefined") {
      localStorage.setItem("customerSlug", slug);
    }
  }, [slug]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#10150f] text-[#e7efe4]">
        Cargando app…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#10150f] px-6 text-center text-[#e7efe4]">
        <p className="font-[family-name:var(--font-display)] text-3xl">
          App de cliente
        </p>
        <p className="text-[#a8b5a4]">
          Inicia sesión para pedidos, puntos, reservas y chat.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(base)}`}
          className="rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white"
        >
          Entrar
        </Link>
        <Link
          href={`/register?role=cliente&next=${encodeURIComponent(base)}`}
          className="text-sm text-emerald-400"
        >
          Crear cuenta cliente
        </Link>
        <Link href={`/r/${slug}`} className="text-xs text-[#8fa08c]">
          Ver web pública
        </Link>
      </div>
    );
  }

  if (error && !restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#10150f] px-6 text-center text-[#e7efe4]">
        <p className="text-xl">{error}</p>
        <Link href="/" className="text-emerald-400">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#10150f] text-[#e7efe4]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#10150f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl leading-none">
              {restaurant?.name ?? "Cliente"}
            </p>
            <p className="mt-1 text-xs text-[#8fa08c]">
              Hola, {user.displayName}
            </p>
          </div>
          <Link href={`/r/${slug}`} className="text-xs text-emerald-400">
            Web
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((t) => {
            const href = `${base}${t.href}`;
            const active =
              t.match === "exact"
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(href);
            const label =
              t.href === "/notificaciones" && unread
                ? `Avisos (${unread})`
                : t.label;
            return (
              <Link
                key={t.href || "home"}
                href={href}
                className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${
                  active
                    ? "bg-emerald-700 text-white"
                    : "border border-white/15 text-[#c5d0c2]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      {error ? (
        <p className="mx-auto max-w-lg px-4 pt-3 text-xs text-amber-300">
          {error}
        </p>
      ) : null}
      <main className="mx-auto max-w-lg px-4 py-6 pb-24">{children}</main>
    </div>
  );
}
