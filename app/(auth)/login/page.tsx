"use client";

import { AuthShell } from "@/modules/auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import { STAFF_ROLES } from "@/lib/roles";
import { signInOrActivate } from "@/services/auth.service";
import { Button, Input, toast } from "@/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function postLoginPath(role: string): string {
  if (role === "mesero" || role === "cajero") return "/waiter";
  if (role === "cliente") return "/";
  if (STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
    return "/dashboard";
  }
  return "/dashboard";
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
      if (next) {
        router.replace(next);
      } else if (user.role === "cliente") {
        const slug =
          typeof window !== "undefined"
            ? localStorage.getItem("customerSlug")
            : null;
        router.replace(slug ? `/c/${slug}` : "/");
      } else {
        router.replace(postLoginPath(user.role));
      }
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
