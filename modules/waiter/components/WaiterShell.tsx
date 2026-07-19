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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0e1410] px-6 text-center text-[#e7efe4]">
        <p className="font-[family-name:var(--font-display)] text-3xl">
          {isCashier ? "Caja" : "Sala · Meseros"}
        </p>
        <p className="text-sm text-[#a8b5a4]">
          {isCashier
            ? "Inicia sesión con tu cuenta de cajero."
            : "Inicia sesión con tu cuenta de mesero."}
        </p>
        <Link
          href={`/login?next=${routes.home}`}
          className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-medium"
        >
          Entrar
        </Link>
      </div>
    );
  }

  // Solo pantalla de carga en la primera vez (no en refrescos → evita parpadeo)
  if ((!ready || loading) && !restaurant) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] text-[#e7efe4]">
        {isCashier ? "Cargando caja…" : "Cargando tu sala…"}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#0e1410] text-[#e7efe4]"
      onPointerDown={() => {
        if (isCashier) return;
        void unlockAudio().then(() => {
          if (isWaiterAudioUnlocked()) setAudioReady(true);
        });
      }}
    >
      {!isCashier ? <ReadyPickupBanner /> : null}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0e1410]/95 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-[family-name:var(--font-display)] text-xl leading-none">
              {isCashier
                ? "Mi caja"
                : floorOnly
                  ? "Mi sala"
                  : (restaurant?.name ?? "Sala")}
            </p>
            <p className="mt-1 text-xs text-[#8fa08c]">
              {user.displayName}
              {restaurant?.name && floorOnly ? ` · ${restaurant.name}` : ""}
              {table ? ` · Mesa ${table.name}` : ""}
              {syncStatus === "offline" ? " · Offline" : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-950/50 px-2.5 py-1.5 text-xs text-amber-200"
              >
                <Volume2 className="h-3.5 w-3.5" /> Sonido
              </button>
            ) : null}
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-[#c5d0c2]"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Admin sala
              </Link>
            ) : null}
            {isAdmin ? (
              <Link href="/pos" className="text-xs text-emerald-400">
                POS
              </Link>
            ) : null}
            {floorOnly ? (
              <button
                type="button"
                onClick={() => {
                  void signOut().then(() => router.replace("/login"));
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-[#c5d0c2]"
              >
                <LogOut className="h-3.5 w-3.5" /> Salir
              </button>
            ) : null}
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-lg">
          <OfflineBanner />
        </div>
      </header>

      <main
        className={`mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] ${
          !isCashier && unread > 0 ? "pt-36" : ""
        }`}
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#121a14]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg justify-between gap-0.5 px-1 py-1.5">
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
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] ${
                  active ? "text-emerald-400" : "text-[#8fa08c]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{t.label}</span>
                {!isCashier &&
                t.href === routes.notifications &&
                unread > 0 ? (
                  <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] text-white">
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
