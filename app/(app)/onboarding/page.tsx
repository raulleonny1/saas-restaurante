"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import { canCreateVenue, homePathForRole } from "@/lib/roles";
import { reloadCurrentUser } from "@/services/auth.service";
import { Button, Input, Skeleton, toast } from "@/ui";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

export default function OnboardingPage() {
  const { user, role, loading: authLoading } = useAuth();
  const { create, restaurant, refresh } = useRestaurant();
  const { refreshInvites } = useTenant();
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const inviteAttempted = useRef(false);

  useEffect(() => {
    if (authLoading || !user) return;

    if (restaurant) {
      router.replace(homePathForRole(role));
      setChecking(false);
      return;
    }

    if (canCreateVenue(role)) {
      setChecking(false);
      return;
    }

    // Invitado (gerente, etc.): unirse al local del dueño, no crear uno nuevo
    if (inviteAttempted.current) {
      router.replace(homePathForRole(role));
      setChecking(false);
      return;
    }
    inviteAttempted.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const n = await refreshInvites();
        await reloadCurrentUser();
        if (n > 0) await refresh();
      } finally {
        if (!cancelled) {
          setChecking(false);
          router.replace(homePathForRole(role));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, role, restaurant, refreshInvites, refresh, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canCreateVenue(role)) {
      toast("Solo el propietario puede crear el restaurante", "error");
      return;
    }
    setLoading(true);
    try {
      await create(name.trim() || "Mi restaurante");
      toast("Restaurante listo", "success");
      router.replace("/dashboard");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || checking || !canCreateVenue(role)) {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-10">
        <Skeleton className="h-10 w-64" />
        <p className="text-sm text-fg-muted">
          {!canCreateVenue(role)
            ? "Comprobando tu acceso al restaurante…"
            : "Cargando…"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="font-display text-4xl tracking-tight">Tu primer restaurante</h1>
      <p className="mt-3 text-fg-muted">
        Solo el propietario crea el local. Gerentes y supervisores entran por
        invitación del dueño (Iniciar sesión), sin crear un restaurante nuevo.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input
          label="Nombre del restaurante"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Café Norte"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Creando…" : "Continuar"}
        </Button>
      </form>
    </div>
  );
}
