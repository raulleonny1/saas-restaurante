"use client";

import { isFirebaseConfigured } from "@/lib/firebase";
import { ROLES_WITH_VENUE, isUserRole } from "@/lib/roles";
import { AuthShell, RoleSelect } from "@/modules/auth";
import { signUp } from "@/services/auth.service";
import type { RoleId } from "@/types/rbac";
import { Button, Input, toast } from "@/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const roleParam = searchParams.get("role");
  const initialRole: RoleId =
    roleParam && isUserRole(roleParam) ? roleParam : "propietario";

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleId>(initialRole);
  const [restaurantName, setRestaurantName] = useState("");
  const [loading, setLoading] = useState(false);
  const firebaseReady = isFirebaseConfigured();
  const needsVenue = ROLES_WITH_VENUE.includes(role);
  const isCliente = role === "cliente";

  const registerHref = useMemo(
    () => (next ? `/login?next=${encodeURIComponent(next)}` : "/login"),
    [next],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp({
        email,
        password,
        displayName: displayName.trim() || "Usuario",
        role,
        restaurantName: needsVenue ? restaurantName : undefined,
      });
      toast("Cuenta creada", "success");
      if (next) {
        router.replace(next);
      } else if (isCliente) {
        const slug =
          typeof window !== "undefined"
            ? localStorage.getItem("customerSlug")
            : null;
        router.replace(slug ? `/c/${slug}` : "/");
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar";
      console.error("[register]", err);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle={
        isCliente
          ? "Registro de cliente para pedidos, reservas y puntos."
          : "Registro con Firebase Auth y rol de plataforma."
      }
    >
      {!firebaseReady ? (
        <div className="mb-4 rounded-[14px] border border-warning bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] px-4 py-3 text-sm">
          Configura <code>NEXT_PUBLIC_FIREBASE_*</code> en <code>.env.local</code>{" "}
          para registrar usuarios.
        </div>
      ) : (
        <div className="mb-4 rounded-[14px] border border-border bg-bg-muted/40 px-4 py-3 text-xs text-fg-muted">
          Si falla Firestore: en Firebase Console → Firestore → Reglas, pega el
          contenido de <code>firestore.rules</code> y pulsa Publicar. También
          activa Authentication → Email/Password.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Nombre"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          required
        />
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
          minLength={6}
          autoComplete="new-password"
          required
        />

        <RoleSelect value={role} onChange={setRole} />

        {needsVenue ? (
          <Input
            label="Nombre del restaurante"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            placeholder="Café Norte"
            required
          />
        ) : null}

        <Button type="submit" className="w-full" disabled={loading || !firebaseReady}>
          {loading ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-fg-muted">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={registerHref}
          className="text-accent underline-offset-2 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Crear cuenta" subtitle="Cargando…">
          <p className="text-sm text-fg-muted">Un momento…</p>
        </AuthShell>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
