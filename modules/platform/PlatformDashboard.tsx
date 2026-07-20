"use client";

import { useAuth } from "@/context/AuthProvider";
import { isPlatformSuperAdmin } from "@/lib/roles";
import {
  BILLING_PLANS,
  formatPlanPrice,
  type BillingPlanId,
} from "@/types/billing";
import {
  activarPlanElegido,
  altaCliente,
  cambiarPlanCliente,
  listClients,
  type ClientRow,
} from "@/modules/platform/services/alta-cliente.service";
import { Alert, Button, Input, Select, toast } from "@/ui";
import { useCallback, useEffect, useState } from "react";

const PLANES_PAGO: BillingPlanId[] = ["starter", "business", "enterprise"];
const PLANES_TODOS: BillingPlanId[] = [
  "trial",
  "starter",
  "business",
  "enterprise",
];

/**
 * Panel SUPERADMIN: ver registros, activar plan elegido, o dar de alta manual.
 */
export function PlatformDashboard() {
  const { user, role, can } = useAuth();
  const soySuper =
    isPlatformSuperAdmin(user) ||
    role === "super_admin" ||
    can("platform.tenants.manage");

  const [clientes, setClientes] = useState<ClientRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [activandoId, setActivandoId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [nombreDueño, setNombreDueño] = useState("");
  const [local, setLocal] = useState("");
  const [plan, setPlan] = useState<BillingPlanId>("business");
  const [resultado, setResultado] = useState<string | null>(null);
  const [passTemp, setPassTemp] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    try {
      setClientes(await listClients());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error al cargar", "error");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (soySuper) void refrescar();
  }, [soySuper, refrescar]);

  if (!soySuper) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Superadmin</h1>
        <Alert tone="warning" title="No eres superadmin">
          <p className="mt-2 text-sm">
            En Firebase → users → tu usuario:{" "}
            <code>role: &quot;super_admin&quot;</code> e{" "}
            <code>isSuperAdmin: true</code> (boolean).
          </p>
        </Alert>
      </div>
    );
  }

  const pendientes = clientes.filter((c) => c.needsActivation);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 pb-20 md:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Superadmin
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Clientes de la plataforma
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Aquí ves a quien se registra solo (elige gratis o un plan de pago) y
          puedes activar lo que compró. También puedes dar de alta manualmente.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            Clientes ({clientes.length})
            {pendientes.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-warning">
                · {pendientes.length} pendientes de activar
              </span>
            ) : null}
          </h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={cargando}
            onClick={() => void refrescar()}
          >
            Actualizar
          </Button>
        </div>

        {cargando ? (
          <p className="text-sm text-fg-muted">Cargando…</p>
        ) : !clientes.length ? (
          <p className="text-sm text-fg-muted">
            Aún no hay clientes. Cuando un dueño se registre en /register
            aparecerá aquí con el plan que eligió.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {clientes.map((c) => (
              <li key={c.id} className="space-y-3 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-fg-muted">{c.ownerEmail}</p>
                    <p className="mt-1 text-xs text-fg-muted">
                      Eligió:{" "}
                      <strong className="text-fg">{c.requestedPlanName}</strong>
                      {c.requestedPlanId !== "trial"
                        ? ` (${formatPlanPrice(BILLING_PLANS[c.requestedPlanId].monthlyPriceCents)}/mes)`
                        : " (gratis)"}
                      {" · "}
                      Ahora: {c.planName} ({c.planStatus})
                    </p>
                  </div>
                  {c.needsActivation ? (
                    <span className="inline-flex w-fit rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
                      Pendiente de activar
                    </span>
                  ) : (
                    <span className="inline-flex w-fit rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                      Activo
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {c.needsActivation ? (
                    <Button
                      size="sm"
                      disabled={activandoId === c.id}
                      onClick={() => {
                        void (async () => {
                          try {
                            setActivandoId(c.id);
                            await activarPlanElegido(c);
                            toast(
                              `Activado: ${c.requestedPlanName}`,
                              "success",
                            );
                            await refrescar();
                          } catch (err) {
                            toast(
                              err instanceof Error ? err.message : "Error",
                              "error",
                            );
                          } finally {
                            setActivandoId(null);
                          }
                        })();
                      }}
                    >
                      {activandoId === c.id
                        ? "Activando…"
                        : `Activar ${c.requestedPlanName}`}
                    </Button>
                  ) : null}
                  <Select
                    aria-label={`Cambiar plan de ${c.name}`}
                    value={c.planId}
                    disabled={activandoId === c.id}
                    onChange={(e) => {
                      const next = e.target.value as BillingPlanId;
                      void (async () => {
                        try {
                          setActivandoId(c.id);
                          await cambiarPlanCliente(c.id, next);
                          toast(
                            `Plan: ${BILLING_PLANS[next].name}`,
                            "success",
                          );
                          await refrescar();
                        } catch (err) {
                          toast(
                            err instanceof Error ? err.message : "Error",
                            "error",
                          );
                        } finally {
                          setActivandoId(null);
                        }
                      })();
                    }}
                  >
                    {PLANES_TODOS.map((id) => (
                      <option key={id} value={id}>
                        {BILLING_PLANS[id].name} (
                        {formatPlanPrice(BILLING_PLANS[id].monthlyPriceCents)})
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-bg-elevated p-5">
        <h2 className="text-lg font-medium">Alta manual</h2>
        <p className="text-sm text-fg-muted">
          Si el cliente no se registró solo: creas el local, el plan queda
          activo y le das acceso por correo.
        </p>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!user) return;
            void (async () => {
              try {
                setGuardando(true);
                setResultado(null);
                setPassTemp(null);
                const r = await altaCliente({
                  ownerEmail: email,
                  ownerName: nombreDueño,
                  restaurantName: local,
                  planId: plan as "starter" | "business" | "enterprise",
                  invitedByUid: user.uid,
                });
                setResultado(r.message);
                if (r.temporaryPassword) setPassTemp(r.temporaryPassword);
                toast(`OK · ${r.planName}`, "success");
                setEmail("");
                setNombreDueño("");
                setLocal("");
                await refrescar();
              } catch (err) {
                toast(err instanceof Error ? err.message : "Error", "error");
              } finally {
                setGuardando(false);
              }
            })();
          }}
        >
          <Input
            label="Correo del dueño"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dueño@bar.com"
          />
          <Input
            label="Nombre del dueño"
            value={nombreDueño}
            onChange={(e) => setNombreDueño(e.target.value)}
            placeholder="María García"
          />
          <Input
            label="Nombre del restaurante / bar"
            required
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Bar Central"
          />
          <Select
            label="Plan contratado"
            value={plan}
            onChange={(e) => setPlan(e.target.value as BillingPlanId)}
          >
            {PLANES_PAGO.map((id) => (
              <option key={id} value={id}>
                {BILLING_PLANS[id].name} —{" "}
                {formatPlanPrice(BILLING_PLANS[id].monthlyPriceCents)}/mes
                {BILLING_PLANS[id].recommended ? " ★" : ""}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={guardando} className="mt-2">
            {guardando ? "Guardando…" : "Dar de alta cliente"}
          </Button>
        </form>

        {resultado ? (
          <Alert tone="success" title="Cliente dado de alta">
            <p className="mt-1 text-sm">{resultado}</p>
            {passTemp ? (
              <p className="mt-2 text-sm">
                Contraseña temporal:{" "}
                <code className="rounded bg-black/20 px-1.5 py-0.5 text-xs">
                  {passTemp}
                </code>
              </p>
            ) : null}
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
