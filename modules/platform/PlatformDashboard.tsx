"use client";

import { useAuth } from "@/context/AuthProvider";
import { isPlatformSuperAdmin } from "@/lib/roles";
import {
  BILLING_PLANS,
  formatPlanPrice,
  type BillingPlanId,
} from "@/types/billing";
import {
  altaCliente,
  cambiarPlanCliente,
  listClients,
  type ClientRow,
} from "@/modules/platform/services/alta-cliente.service";
import { Alert, Button, Input, Select, toast } from "@/ui";
import { useCallback, useEffect, useState } from "react";

const PLANES: BillingPlanId[] = ["starter", "business", "enterprise"];

/**
 * Panel SUPERADMIN: dar de alta clientes (dueños) con correo + plan.
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
            Entra con tu cuenta. Luego en Firebase Console → Firestore →
            colección <b>users</b> → tu usuario, pon estos campos:
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-black/30 p-3 text-xs">
{`role: "super_admin"   (string)
isSuperAdmin: true     (boolean, NO texto "true")`}
          </pre>
          <p className="mt-2 text-sm">
            Recarga la página (o ve a /superadmin) y verás el alta de clientes.
          </p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 pb-20 md:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Superadmin
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Alta de clientes
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Tú das de alta al dueño del restaurante con su correo y el plan que
          ha contratado. Él después mete a sus gerentes y empleados.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-bg-elevated p-5">
        <h2 className="text-lg font-medium">Nuevo cliente</h2>
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
            label="Correo del dueño (cliente)"
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
            label="Plan que ha contratado"
            value={plan}
            onChange={(e) => setPlan(e.target.value as BillingPlanId)}
          >
            {PLANES.map((id) => (
              <option key={id} value={id}>
                {BILLING_PLANS[id].name} —{" "}
                {formatPlanPrice(BILLING_PLANS[id].monthlyPriceCents)}/mes
                {BILLING_PLANS[id].recommended ? " ★ recomendado" : ""}
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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            Mis clientes ({clientes.length})
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
            Todavía no hay clientes. Usa el formulario de arriba.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {clientes.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-fg-muted">{c.ownerEmail}</p>
                </div>
                <Select
                  value={
                    PLANES.includes(c.planId as BillingPlanId)
                      ? c.planId
                      : "starter"
                  }
                  onChange={(e) => {
                    const next = e.target.value as
                      | "starter"
                      | "business"
                      | "enterprise";
                    void (async () => {
                      try {
                        await cambiarPlanCliente(c.id, next);
                        toast(
                          `Plan cambiado a ${BILLING_PLANS[next].name}`,
                          "success",
                        );
                        await refrescar();
                      } catch (err) {
                        toast(
                          err instanceof Error ? err.message : "Error",
                          "error",
                        );
                      }
                    })();
                  }}
                >
                  {PLANES.map((id) => (
                    <option key={id} value={id}>
                      {BILLING_PLANS[id].name} (
                      {formatPlanPrice(BILLING_PLANS[id].monthlyPriceCents)})
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
