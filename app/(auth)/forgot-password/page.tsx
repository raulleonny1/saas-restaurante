"use client";

import { isFirebaseConfigured } from "@/lib/firebase";
import { AuthShell } from "@/modules/auth";
import { resetPassword } from "@/services/auth.service";
import { Button, Input, toast } from "@/ui";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const firebaseReady = isFirebaseConfigured();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword({ email });
      setSent(true);
      toast("Email de recuperación enviado", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al enviar", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace de restablecimiento con Firebase Auth."
    >
      {!firebaseReady ? (
        <div className="mb-4 rounded-[14px] border border-warning bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] px-4 py-3 text-sm">
          Configura <code>NEXT_PUBLIC_FIREBASE_*</code> en <code>.env.local</code>.
        </div>
      ) : null}

      {sent ? (
        <div className="space-y-4">
          <p className="rounded-[14px] border border-border bg-bg-elevated px-4 py-4 text-sm">
            Si existe una cuenta con <strong>{email}</strong>, recibirás un email para
            restablecer la contraseña. Revisa también spam.
          </p>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-[12px] bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            Volver al login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Button type="submit" className="w-full" disabled={loading || !firebaseReady}>
            {loading ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm text-fg-muted">
        <Link href="/login" className="text-accent underline-offset-2 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
