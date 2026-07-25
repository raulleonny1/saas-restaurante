"use client";

import { isFirebaseConfigured } from "@/lib/firebase";
import {
  homePathForRole,
  isFloorAppRole,
  isKitchenStaffRole,
  isPlatformSuperAdmin,
} from "@/lib/roles";
import { AuthShell } from "@/modules/auth";
import {
  activateStaffPin,
  lookupStaffByEmail,
  type StaffLookupInfo,
} from "@/services/auth.service";
import type { RoleId } from "@/types/rbac";
import { Alert, Button, Input, toast } from "@/ui";
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
  if (role === "gerente" || role === "supervisor") return homePathForRole(role);
  if (next) return next;
  return homePathForRole(role);
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const emailPrefill = searchParams.get("email")?.trim() || "";

  const [step, setStep] = useState<"email" | "pin">(
    emailPrefill ? "email" : "email",
  );
  const [email, setEmail] = useState(emailPrefill);
  const [info, setInfo] = useState<StaffLookupInfo | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [loading, setLoading] = useState(false);
  const firebaseReady = isFirebaseConfigured();

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setInfo(null);
    try {
      const data = await lookupStaffByEmail(email);
      if (!data.found) {
        toast(
          data.message ||
            "Este correo no está dado de alta. Pide al dueño o superadmin que te registre.",
          "error",
        );
        return;
      }
      setInfo(data);
      if (data.hasAuthAccount) {
        toast("Ya tienes PIN. Ve a Iniciar sesión.", "success");
        router.push(
          `/login?email=${encodeURIComponent(data.email)}${
            next ? `&next=${encodeURIComponent(next)}` : ""
          }`,
        );
        return;
      }
      setStep("pin");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al consultar", "error");
    } finally {
      setLoading(false);
    }
  }

  async function onActivate(e: FormEvent) {
    e.preventDefault();
    if (!info) return;
    if (pin !== pin2) {
      toast("Los PIN no coinciden", "error");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      toast("El PIN debe ser exactamente 6 dígitos", "error");
      return;
    }
    setLoading(true);
    try {
      const user = await activateStaffPin({ email: info.email, pin });
      toast("PIN creado. Sesión iniciada", "success");
      router.replace(resolvePostLogin(user.role, next, user.isSuperAdmin));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al activar", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Activar acceso"
      subtitle="Solo dueños y empleados ya dados de alta. Introduce tu correo, confirma tus datos y crea un PIN de 6 dígitos."
    >
      {!firebaseReady ? (
        <div className="mb-4 rounded-[14px] border border-warning bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] px-4 py-3 text-sm">
          Configura <code>NEXT_PUBLIC_FIREBASE_*</code> y{" "}
          <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> para activar cuentas.
        </div>
      ) : null}

      {step === "email" ? (
        <form onSubmit={onLookup} className="space-y-4">
          <Input
            label="Correo (el del alta)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="tu@empresa.com"
            required
          />
          <p className="text-xs text-fg-muted">
            Clientes del restaurante (comensales) no se registran aquí. Este
            acceso es para el equipo del local.
          </p>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !firebaseReady}
          >
            {loading ? "Buscando…" : "Continuar"}
          </Button>
        </form>
      ) : (
        <form onSubmit={onActivate} className="space-y-4">
          {info ? (
            <Alert tone="success" title="Alta encontrada">
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Nombre</dt>
                  <dd className="font-medium">{info.displayName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Correo</dt>
                  <dd className="font-medium">{info.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Rol</dt>
                  <dd className="font-medium">{info.roleLabel}</dd>
                </div>
                {info.restaurantName ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">Local</dt>
                    <dd className="font-medium text-right">
                      {info.restaurantName}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Alert>
          ) : null}

          <Input
            label="PIN de 6 dígitos"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{6}"
            maxLength={6}
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            required
            hint="Solo números. Lo usarás para iniciar sesión."
          />
          <Input
            label="Repite el PIN"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{6}"
            maxLength={6}
            value={pin2}
            onChange={(e) =>
              setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            required
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={loading}
              onClick={() => {
                setStep("email");
                setPin("");
                setPin2("");
              }}
            >
              Cambiar correo
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !firebaseReady || pin.length !== 6}
            >
              {loading ? "Guardando…" : "Crear PIN y entrar"}
            </Button>
          </div>
        </form>
      )}

      <p className="mt-6 text-sm text-fg-muted">
        ¿Ya tienes PIN?{" "}
        <Link
          href={
            next
              ? `/login?next=${encodeURIComponent(next)}`
              : "/login"
          }
          className="text-accent underline-offset-2 hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Activar acceso" subtitle="Cargando…">
          <p className="text-sm text-fg-muted">Un momento…</p>
        </AuthShell>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
