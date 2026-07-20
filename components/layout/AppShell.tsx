"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import {
  canCreateVenue,
  homePathForRole,
  isFloorAppRole,
  isKitchenStaffRole,
  isPlatformSuperAdmin,
} from "@/lib/roles";
import { reloadCurrentUser } from "@/services/auth.service";
import { Button, Skeleton } from "@/ui";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, role, signOut } = useAuth();
  const { restaurant, loading: restLoading, refresh } = useRestaurant();
  const { refreshInvites } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinTried, setJoinTried] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [ready, loading, user, router]);

  const platformAdmin = isPlatformSuperAdmin(user);

  // Superadmin = solo plataforma (alta de clientes). Sin POS/cocina/etc.
  useEffect(() => {
    if (!ready || loading || !user || !platformAdmin) return;
    if (!pathname.startsWith("/superadmin")) {
      router.replace("/superadmin");
    }
  }, [ready, loading, user, platformAdmin, pathname, router]);

  // Mesero / cajero: no entran al panel del dueño
  useEffect(() => {
    if (!ready || loading || !user || platformAdmin) return;
    if (isFloorAppRole(role)) {
      router.replace(homePathForRole(role));
    }
  }, [ready, loading, user, platformAdmin, role, router]);

  // Cocinero / barista: solo cocina|barra + carta (nada de dashboard admin)
  useEffect(() => {
    if (!ready || loading || !user || !role || platformAdmin) return;
    if (!isKitchenStaffRole(role)) return;
    const allowed =
      pathname.startsWith("/kitchen") ||
      pathname.startsWith("/bar") ||
      pathname.startsWith("/inventory") ||
      pathname.startsWith("/login");
    if (!allowed) {
      router.replace(homePathForRole(role));
    }
  }, [ready, loading, user, platformAdmin, role, pathname, router]);

  // Solo el dueño crea restaurante. Gerente/supervisor/staff invitado NUNCA /onboarding.
  useEffect(() => {
    if (!ready || loading || restLoading || !user || !role) return;
    if (platformAdmin || isFloorAppRole(role)) return;

    if (!restaurant && canCreateVenue(role) && pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }

    if (!restaurant && !canCreateVenue(role) && pathname === "/onboarding") {
      router.replace(homePathForRole(role));
    }
  }, [
    ready,
    loading,
    user,
    restLoading,
    restaurant,
    role,
    platformAdmin,
    router,
    pathname,
  ]);

  // Staff sin local: aceptar invitaciones / índice de empleados y recargar perfil
  useEffect(() => {
    if (!ready || loading || restLoading || !user || !role) return;
    if (platformAdmin) return;
    if (restaurant || canCreateVenue(role) || isFloorAppRole(role)) return;
    if (joinTried || joining) return;

    let cancelled = false;
    setJoining(true);
    void (async () => {
      try {
        const n = await refreshInvites();
        const fresh = await reloadCurrentUser();
        if (!cancelled && (n > 0 || (fresh?.restaurantIds?.length ?? 0) > 0)) {
          await refresh();
        }
      } finally {
        if (!cancelled) {
          setJoining(false);
          setJoinTried(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    loading,
    restLoading,
    user,
    role,
    platformAdmin,
    restaurant,
    joinTried,
    joining,
    refreshInvites,
    refresh,
  ]);

  if (!ready || loading || !user || isFloorAppRole(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  // Super admin de plataforma: panel /superadmin sin restaurante propio
  if (platformAdmin) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
          <MobileNav />
        </div>
      </div>
    );
  }

  // Dueño en onboarding: dejar pasar el formulario
  if (!restaurant && canCreateVenue(role) && pathname === "/onboarding") {
    return (
      <div className="flex min-h-screen">
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    );
  }

  // Staff invitado sin restaurante aún (o cliente colado en panel)
  if (!restaurant && !canCreateVenue(role)) {
    if (joining || restLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center p-8">
          <div className="w-full max-w-sm space-y-3">
            <Skeleton className="h-8 w-40" />
            <p className="text-sm text-fg-muted">Uniendo tu acceso al restaurante…</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-display text-3xl tracking-tight">Sin acceso al local</h1>
          <p className="text-sm text-fg-muted">
            El dueño debe darte de alta en Empleados con el rol correcto (gerente,
            supervisor, mesero…). Luego vuelve a iniciar sesión con ese email.
            No crees un restaurante nuevo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              onClick={() => {
                setJoinTried(false);
              }}
            >
              Reintentar
            </Button>
            <Button variant="secondary" onClick={() => void signOut()}>
              Salir
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
