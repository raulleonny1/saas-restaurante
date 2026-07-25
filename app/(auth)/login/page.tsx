"use client";

import { AuthShell } from "@/modules/auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  homePathForRole,
  isFloorAppRole,
  isKitchenStaffRole,
  isPlatformSuperAdmin,
} from "@/lib/roles";
import { signInWithPin } from "@/services/auth.service";
import type { RoleId } from "@/types/rbac";
import { Button, Input, toast } from "@/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function resolvePostLogin(
  role: RoleId | string,
  next: string | null,
  isSuperAdmin?: boolean,
): string {
  if (
    role === "super_admin" ||
    isSuperAdmin ||
    isPlatformSuperAdmin({ role: role as RoleId, isSuperAdmin })
  ) {
    return "/superadmin";
  }
  if (isFloorAppRole(role as RoleId)) return homePathForRole(role);
  if (isKitchenStaffRole(role as RoleId)) return homePathForRole(role);
  if (role === "cliente") {
    if (typeof window !== "undefined") {
      const slug = localStorage.getItem("customerSlug");
      if (slug) return `/c/${slug}`;
    }
    return next?.startsWith("/c/") ? next : "/";
  }
  if (
    (role === "gerente" || role === "supervisor") &&
    (next === "/dashboard" || next === "/onboarding")
  ) {
    return homePathForRole(role);
  }
  if (next) return next;
  return homePathForRole(role);
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email")?.trim() || "");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const firebaseReady = isFirebaseConfigured();
  const next = safeNext(searchParams.get("next"));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      toast("El PIN debe ser exactamente 6 dígitos", "error");
      return;
    }
    setLoading(true);
    try {
      const user = await signInWithPin({ email, pin });

      if (
        user.role === "cliente" &&
        (!user.restaurantIds || user.restaurantIds.length === 0)
      ) {
        toast(
          "Sin acceso al local. Activa tu PIN en Crear acceso o pide el alta al dueño.",
          "error",
        );
        return;
      }

      toast("Sesión iniciada", "success");
      router.replace(resolvePostLogin(user.role, next, user.isSuperAdmin));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al entrar";
      if (/incorrecta|invalid-credential|wrong-password|user-not-found/i.test(msg)) {
        toast(
          "PIN incorrecto o cuenta no activada. Si es la primera vez, ve a Activar acceso.",
          "error",
        );
      } else {
        toast(msg, "error");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Dueños y empleados: correo del alta + PIN de 6 dígitos."
    >
      {!firebaseReady ? (
        <div className="mb-4 rounded-[14px] border border-warning bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] px-4 py-3 text-sm">
          Configura <code>NEXT_PUBLIC_FIREBASE_*</code> en <code>.env.local</code>{" "}
          para usar Firebase Auth.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          label="PIN (6 dígitos)"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="\d{6}"
          maxLength={6}
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          required
          hint="Si aún no tienes PIN, actívalo primero con tu correo."
        />
        <Button
          type="submit"
          className="w-full"
          disabled={loading || !firebaseReady || pin.length !== 6}
        >
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-fg-muted">
        ¿Primera vez?{" "}
        <Link
          href={
            next
              ? `/register?next=${encodeURIComponent(next)}`
              : "/register"
          }
          className="text-accent underline-offset-2 hover:underline"
        >
          Activar acceso con tu correo
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Iniciar sesión" subtitle="Cargando…">
          <p className="text-sm text-fg-muted">Un momento…</p>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
