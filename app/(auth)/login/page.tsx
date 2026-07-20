"use client";

import { AuthShell } from "@/modules/auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  homePathForRole,
  isFloorAppRole,
  isKitchenStaffRole,
  isPlatformSuperAdmin,
} from "@/lib/roles";
import { signInOrActivate } from "@/services/auth.service";
import type { RoleId } from "@/types/rbac";
import { Button, Input, toast } from "@/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/** Mesero/cajero nunca van al panel admin, aunque venga ?next=/dashboard */
function resolvePostLogin(
  role: RoleId | string,
  next: string | null,
  isSuperAdmin?: boolean,
): string {
  if (role === "super_admin" || isSuperAdmin || isPlatformSuperAdmin({ role: role as RoleId, isSuperAdmin })) {
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
  // No mandar gerente/supervisor al dashboard/onboarding del dueño
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const firebaseReady = isFirebaseConfigured();
  const next = safeNext(searchParams.get("next"));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await signInOrActivate({ email, password });

      // Empleado mal activado: Auth ok pero sigue como cliente sin restaurante
      if (
        user.role === "cliente" &&
        (!user.restaurantIds || user.restaurantIds.length === 0)
      ) {
        toast(
          "Cuenta creada, pero aún sin acceso al local. Como dueño: abre Empleados (crea el acceso) y vuelve a entrar aquí.",
          "error",
        );
        return;
      }

      toast("Sesión iniciada", "success");
      router.replace(resolvePostLogin(user.role, next, user.isSuperAdmin));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al entrar", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Iniciar sesión"
      subtitle="Empleados: usa el email del alta. Si es la primera vez, elige aquí tu contraseña."
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
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          minLength={6}
          required
          hint="Primera vez: escribe la clave que quieras usar. Ya tienes cuenta: la tuya."
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={loading || !firebaseReady}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-fg-muted">
        ¿Dueño o cliente nuevo?{" "}
        <Link
          href={
            next
              ? `/register?role=cliente&next=${encodeURIComponent(next)}`
              : "/register"
          }
          className="text-accent underline-offset-2 hover:underline"
        >
          Crear cuenta
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
