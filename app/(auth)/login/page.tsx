"use client";

import { AuthShell } from "@/modules/auth";
import { isFirebaseConfigured } from "@/lib/firebase";
import { signIn } from "@/services/auth.service";
import { Button, Input, toast } from "@/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
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
      const user = await signIn({ email, password });
      toast("Sesión iniciada", "success");
      if (next) {
        router.replace(next);
      } else if (user.role === "cliente") {
        const slug =
          typeof window !== "undefined"
            ? localStorage.getItem("customerSlug")
            : null;
        router.replace(slug ? `/c/${slug}` : "/");
      } else if (user.role === "mesero" || user.role === "cajero") {
        router.replace("/waiter");
      } else {
        router.replace("/dashboard");
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
      subtitle="Acceso con Firebase Authentication."
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
          required
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
        ¿No tienes cuenta?{" "}
        <Link
          href={
            next
              ? `/register?role=cliente&next=${encodeURIComponent(next)}`
              : "/register"
          }
          className="text-accent underline-offset-2 hover:underline"
        >
          Regístrate
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
