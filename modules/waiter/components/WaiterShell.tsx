"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { canManageRestaurant, isFloorAppRole } from "@/lib/roles";
import { useFloorRoutes } from "@/modules/floor/FloorRoutesContext";
import { OfflineBanner } from "@/modules/pos/components/OfflineBanner";
import { usePos } from "@/modules/pos/context/PosProvider";
import { ReadyPickupBanner } from "@/modules/waiter/components/ReadyPickupBanner";
import { useWaiterNotifications } from "@/modules/waiter/context/WaiterNotificationsProvider";
import {
  Bell,
  History,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Printer,
  QrCode,
  Receipt,
  ShoppingBag,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  isWaiterAudioUnlocked,
  playWaiterPickupAlarm,
  unlockWaiterAudio,
} from "@/modules/waiter/domain/alertSound";

export function WaiterShell({
  children,
  unread = 0,
}: {
  children: ReactNode;
  unread?: number;
}) {
  const { user, role, signOut } = useAuth();
  const { restaurant, loading } = useRestaurant();
  const { ready, syncStatus, selectedTableId, tables } = usePos();
  const { unlockAudio } = useWaiterNotifications();
  const routes = useFloorRoutes();
  const pathname = usePathname();
  const router = useRouter();
  const table = tables.find((t) => t.id === selectedTableId);
  const floorOnly = isFloorAppRole(role);
  const isCashier = routes.base === "/caja";
  const isAdmin = canManageRestaurant(role ?? undefined);
  const [audioReady, setAudioReady] = useState(false);

  /** Caja en monitor TPV: ancho completo. Mesero: ancho en pedido/cobro. */
  const wideTpv =
    isCashier ||
    pathname.startsWith(routes.order) ||
    pathname.startsWith(routes.pay);
  const contentMax = wideTpv ? "max-w-5xl" : "max-w-lg";

  const tabs = useMemo(() => {
    if (isCashier) {
      return [
        {
          href: routes.home,
          label: "En vivo",
          icon: LayoutGrid,
          match: "exact" as const,
        },
        { href: routes.pay, label: "Cobrar", icon: Receipt },
        { href: routes.history, label: "Caja", icon: History },
        { href: routes.order, label: "Pedido", icon: ShoppingBag },
        { href: routes.printers, label: "Impr.", icon: Printer },
      ];
    }
    return [
      {
        href: routes.home,
        label: "Mesas",
        icon: LayoutGrid,
        match: "exact" as const,
      },
      { href: routes.order, label: "Pedido", icon: ShoppingBag },
      { href: routes.pay, label: "Cobrar", icon: Receipt },
      { href: routes.qr, label: "QR", icon: QrCode },
      { href: routes.history, label: "Caja", icon: History },
      { href: routes.notifications, label: "Avisos", icon: Bell },
    ];
  }, [isCashier, routes]);

  if (!user) {
    return (
      <div
        className={`flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center text-[#e7efe4] ${
          isCashier
            ? "bg-[#0e1410]"
            : "bg-[radial-gradient(ellipse_at_top,_#1a2e24_0%,_#0c1210_55%,_#0a0f0d_100%)]"
        }`}
      >
        <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {isCashier ? "Caja" : "Sala"}
        </p>
        <p className="max-w-xs text-sm text-[#a8b5a4]">
          {isCashier
            ? "Inicia sesión con tu cuenta de cajero."
            : "Entra con tu cuenta de mesero para ver tus mesas."}
        </p>
        <Link
          href={`/login?next=${routes.home}`}
          className="rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold shadow-lg shadow-emerald-950/40"
        >
          Entrar
        </Link>
      </div>
    );
  }

  if ((!ready || loading) && !restaurant) {
    return (
      <div
        className={`flex min-h-dvh items-center justify-center text-[#e7efe4] ${
          isCashier
            ? "bg-[#0e1410]"
            : "bg-[radial-gradient(ellipse_at_top,_#1a2e24_0%,_#0c1210_55%,_#0a0f0d_100%)]"
        }`}
      >
        {isCashier ? "Cargando caja…" : "Cargando tu sala…"}
      </div>
    );
  }

  return (
    <div
      className={`relative flex min-h-dvh flex-col text-[#e7efe4] ${
        isCashier
          ? "bg-[#0e1410]"
          : "bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,_#1f3d32_0%,_#0e1410_45%,_#0a0f0d_100%)]"
      }`}
      onPointerDown={() => {
        if (isCashier) return;
        void unlockAudio().then(() => {
          if (isWaiterAudioUnlocked()) setAudioReady(true);
        });
      }}
    >
      {!isCashier ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_20%_0%,_rgba(52,211,153,0.12),_transparent_50%),radial-gradient(circle_at_80%_10%,_rgba(34,211,238,0.08),_transparent_45%)]"
        />
      ) : null}

      {!isCashier ? <ReadyPickupBanner /> : null}

      <header
        className={`sticky top-0 z-40 px-4 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl ${
          isCashier
            ? "border-b border-white/10 bg-[#0e1410]/95"
            : "border-b border-white/[0.07] bg-[#0e1410]/75"
        }`}
      >
        <div
          className={`relative mx-auto flex items-center justify-between gap-3 ${contentMax}`}
        >
          <div className="min-w-0">
            {!isCashier ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">
                Sala · mesero
              </p>
            ) : null}
            <p
              className={`truncate font-[family-name:var(--font-display)] leading-none ${
                isCashier ? "text-xl" : "text-2xl tracking-tight"
              }`}
            >
              {isCashier
                ? "Mi caja"
                : floorOnly
                  ? "Mi sala"
                  : (restaurant?.name ?? "Sala")}
            </p>
            <p className="mt-1 truncate text-xs text-[#8fa08c]">
              {user.displayName}
              {restaurant?.name && floorOnly ? ` · ${restaurant.name}` : ""}
              {table ? (
                <span className="text-emerald-300/90">
                  {" "}
                  · Mesa {table.name}
                </span>
              ) : null}
              {syncStatus === "offline" ? (
                <span className="text-amber-300"> · Offline</span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {!isCashier && !audioReady ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    await unlockWaiterAudio();
                    await unlockAudio();
                    await playWaiterPickupAlarm();
                    setAudioReady(isWaiterAudioUnlocked());
                  })();
                }}
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100"
              >
                <Volume2 className="h-3.5 w-3.5" /> Sonido
              </button>
            ) : null}
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-[#c5d0c2]"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Admin
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                href="/pos"
                className="rounded-full px-2.5 py-2 text-xs font-medium text-emerald-400"
              >
                POS
              </Link>
            ) : null}
            {floorOnly ? (
              <button
                type="button"
                onClick={() => {
                  void signOut().then(() => router.replace("/login"));
                }}
                className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-[#c5d0c2]"
              >
                <LogOut className="h-3.5 w-3.5" /> Salir
              </button>
            ) : null}
          </div>
        </div>
        <div className={`relative mx-auto mt-2 ${contentMax}`}>
          <OfflineBanner />
        </div>
      </header>

      <main
        className={`relative mx-auto w-full flex-1 px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] ${contentMax} ${
          !isCashier && unread > 0 ? "pt-36" : ""
        }`}
      >
        {children}
      </main>

      <nav
        className={`fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl ${
          isCashier
            ? "border-t border-white/10 bg-[#121a14]/95"
            : "border-t border-white/[0.08] bg-[#0c1210]/90"
        }`}
      >
        <div
          className={`mx-auto flex justify-between gap-0.5 px-1.5 py-2 ${contentMax}`}
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active =
              t.match === "exact"
                ? pathname === t.href
                : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`relative flex min-h-14 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] transition-colors ${
                  active
                    ? isCashier
                      ? "text-emerald-400"
                      : "bg-emerald-500/15 text-emerald-300"
                    : "text-[#7a8a76]"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="truncate font-medium">{t.label}</span>
                {!isCashier &&
                t.href === routes.notifications &&
                unread > 0 ? (
                  <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-[#04120c]">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
