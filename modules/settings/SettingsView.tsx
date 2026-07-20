"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import { isSalaAdminRole, ROLE_LABELS, STAFF_ROLES } from "@/lib/roles";
import {
  changePlan,
  markInvoicePaid,
} from "@/modules/tenant/services/billing.service";
import {
  archiveBranch,
  createBranch,
  updateBranch,
} from "@/modules/tenant/services/branches.service";
import {
  inviteMember,
  listPendingInvites,
  revokeInvite,
  updateMember,
} from "@/modules/tenant/services/members.service";
import { PrinterSetupPanel } from "@/modules/pos/components/PrinterSetupPanel";
import { updateTenantSettings } from "@/modules/tenant/services/settings.service";
import type { BillingPlanId, MemberInvite } from "@/types/billing";
import {
  BILLING_PLANS,
  formatPlanPrice,
  normalizeBillingPlanId,
} from "@/types/billing";
import type { RoleId } from "@/types/rbac";
import {
  Alert,
  Button,
  Input,
  PageHeader,
  Select,
  Skeleton,
  toast,
} from "@/ui";
import { useEffect, useState } from "react";

type Tab = "general" | "branches" | "users" | "billing";

export function SettingsView() {
  const { can, user, role } = useAuth();
  const { restaurant, restaurantId, refresh } = useRestaurant();
  const { ready, members, branches, billing, invoices, canManage } = useTenant();
  const [tab, setTab] = useState<Tab>("general");
  const canEditSettings =
    can("settings.manage") || canManage || isSalaAdminRole(role);

  if (!ready || !restaurantId || !restaurant) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!can("settings.read") && !canManage && !isSalaAdminRole(role)) {
    return (
      <Alert tone="warning" title="Sin acceso">
        No tienes permiso para ver los ajustes del restaurante.
      </Alert>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "branches", label: "Sucursales" },
    { id: "users", label: "Usuarios" },
    { id: "billing", label: "Facturación" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ajustes multi-tenant"
        description={`${restaurant.name} · datos y facturación aislados de otros restaurantes.`}
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-accent text-white"
                : "text-fg-muted hover:bg-bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <GeneralPanel
          restaurantId={restaurantId}
          restaurant={restaurant}
          canEdit={canEditSettings}
          onSaved={() => void refresh()}
        />
      ) : null}
      {tab === "branches" ? (
        <BranchesPanel
          restaurantId={restaurantId}
          branches={branches}
          canEdit={canManage}
        />
      ) : null}
      {tab === "users" ? (
        <UsersPanel
          restaurantId={restaurantId}
          restaurantName={restaurant.name}
          members={members}
          branches={branches}
          canEdit={can("employees.manage") || canManage}
          actorUid={user?.uid ?? ""}
        />
      ) : null}
      {tab === "billing" ? (
        <BillingPanel
          restaurantId={restaurantId}
          billing={billing}
          invoices={invoices}
          canEdit={can("billing.manage") || canManage}
        />
      ) : null}
    </div>
  );
}

function GeneralPanel({
  restaurantId,
  restaurant,
  canEdit,
  onSaved,
}: {
  restaurantId: string;
  restaurant: NonNullable<ReturnType<typeof useRestaurant>["restaurant"]>;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(restaurant.name);
  const [legalName, setLegalName] = useState(restaurant.legalName ?? "");
  const [email, setEmail] = useState(restaurant.email ?? "");
  const [phone, setPhone] = useState(restaurant.phone ?? "");
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [tax, setTax] = useState(String(restaurant.settings.taxPercent));
  const [tip, setTip] = useState(String(restaurant.settings.tipDefaultPercent));
  const [locale, setLocale] = useState(restaurant.settings.locale);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(restaurant.name);
    setLegalName(restaurant.legalName ?? "");
    setEmail(restaurant.email ?? "");
    setPhone(restaurant.phone ?? "");
    setAddress(restaurant.address ?? "");
    setTax(String(restaurant.settings.taxPercent));
    setTip(String(restaurant.settings.tipDefaultPercent));
    setLocale(restaurant.settings.locale);
  }, [restaurant]);

  return (
    <div className="space-y-8">
      <form
        className="max-w-xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canEdit) return;
          void (async () => {
            try {
              setBusy(true);
              await updateTenantSettings({
                restaurantId,
                patch: {
                  name: name.trim(),
                  legalName: legalName.trim() || undefined,
                  email: email.trim() || undefined,
                  phone: phone.trim() || undefined,
                  address: address.trim() || undefined,
                  settings: {
                    taxPercent: Number(tax) || 0,
                    tipDefaultPercent: Number(tip) || 0,
                    locale,
                  },
                },
              });
              toast("Configuración guardada", "success");
              onSaved();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Error", "error");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <Input label="Nombre comercial" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
        <Input label="Razón social" value={legalName} onChange={(e) => setLegalName(e.target.value)} disabled={!canEdit} />
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
        <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
        <Input label="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEdit} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="IVA %" type="number" value={tax} onChange={(e) => setTax(e.target.value)} disabled={!canEdit} />
          <Input label="Propina %" type="number" value={tip} onChange={(e) => setTip(e.target.value)} disabled={!canEdit} />
        </div>
        <Input label="Locale" value={locale} onChange={(e) => setLocale(e.target.value)} disabled={!canEdit} />
        <p className="text-xs text-fg-muted">
          ID tenant: <code>{restaurantId}</code> · moneda {restaurant.currency} · TZ{" "}
          {restaurant.timezone}
        </p>
        {canEdit ? (
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        ) : null}
      </form>

      <section className="max-w-3xl rounded-[var(--radius-xl)] border border-border bg-bg-elevated p-4 sm:p-5">
        <PrinterSetupPanel
          restaurantId={restaurantId}
          restaurantName={restaurant.name}
          kitchenOutput={restaurant.settings.kitchenOutput ?? "kds"}
          printers={restaurant.settings.printers}
          canEdit={canEdit}
          onSaved={onSaved}
        />
      </section>
    </div>
  );
}

function BranchesPanel({
  restaurantId,
  branches,
  canEdit,
}: {
  restaurantId: string;
  branches: ReturnType<typeof useTenant>["branches"];
  canEdit: boolean;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border">
        {branches.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium">
                {b.name}{" "}
                {b.isDefault ? (
                  <span className="text-xs text-accent">(principal)</span>
                ) : null}
              </p>
              <p className="text-caption">
                {b.code} · {b.status}
                {b.address ? ` · ${b.address}` : ""}
              </p>
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                {!b.isDefault ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void updateBranch({
                        restaurantId,
                        branchId: b.id,
                        patch: { isDefault: true },
                      }).then(() => toast("Sucursal principal actualizada", "success"))
                    }
                  >
                    Hacer principal
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    void archiveBranch({
                      restaurantId,
                      branchId: b.id,
                      clearDefault: b.isDefault,
                    }).then(() => toast("Sucursal archivada", "success"))
                  }
                >
                  Archivar
                </Button>
              </div>
            ) : null}
          </li>
        ))}
        {!branches.length ? (
          <li className="px-4 py-8 text-center text-sm text-fg-muted">
            Sin sucursales
          </li>
        ) : null}
      </ul>

      {canEdit ? (
        <form
          className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              try {
                setBusy(true);
                await createBranch({
                  restaurantId,
                  name: name.trim(),
                  code: code.trim() || undefined,
                  isDefault: branches.length === 0,
                });
                setName("");
                setCode("");
                toast("Sucursal creada", "success");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Error", "error");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <Input
            label="Nueva sucursal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Código"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="NORTE"
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            Añadir
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function UsersPanel({
  restaurantId,
  restaurantName,
  members,
  branches,
  canEdit,
  actorUid,
}: {
  restaurantId: string;
  restaurantName: string;
  members: ReturnType<typeof useTenant>["members"];
  branches: ReturnType<typeof useTenant>["branches"];
  canEdit: boolean;
  actorUid: string;
}) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<RoleId>("mesero");
  const [invites, setInvites] = useState<MemberInvite[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canEdit) {
      setInvites([]);
      return;
    }
    void listPendingInvites(restaurantId)
      .then(setInvites)
      .catch(() => setInvites([]));
  }, [restaurantId, members.length, canEdit]);

  return (
    <div className="space-y-6">
      <Alert tone="info" title="Usuarios por restaurante">
        Cada persona tiene un rol y permisos dentro de este tenant. Al cambiar de
        restaurante en el selector, cambian los permisos efectivos.
      </Alert>

      <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border">
        {members.map((m) => (
          <li key={m.uid} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{m.displayName}</p>
              <p className="text-caption">
                {m.email} · {ROLE_LABELS[m.roleId] ?? m.roleId}
                {!m.active ? " · inactivo" : ""}
                {m.branchIds.length
                  ? ` · ${m.branchIds.length} sucursal(es)`
                  : " · todas las sucursales"}
              </p>
            </div>
            {canEdit && m.uid !== actorUid ? (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Rol"
                  value={m.roleId}
                  onChange={(e) => {
                    const next = e.target.value as RoleId;
                    void updateMember({
                      restaurantId,
                      uid: m.uid,
                      patch: { roleId: next, role: next },
                    })
                      .then(() => toast("Rol actualizado", "success"))
                      .catch((err) =>
                        toast(err instanceof Error ? err.message : "Error", "error"),
                      );
                  }}
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void updateMember({
                      restaurantId,
                      uid: m.uid,
                      patch: { active: !m.active },
                    }).then(() => toast(m.active ? "Desactivado" : "Activado", "success"))
                  }
                >
                  {m.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {invites.length ? (
        <div>
          <h3 className="mb-2 text-sm font-medium">Invitaciones pendientes</h3>
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  {inv.email} · {ROLE_LABELS[inv.roleId]}
                </span>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void revokeInvite(inv.id).then(() =>
                        setInvites((prev) => prev.filter((i) => i.id !== inv.id)),
                      )
                    }
                  >
                    Revocar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canEdit ? (
        <form
          className="grid max-w-xl gap-3 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              try {
                setBusy(true);
                const inv = await inviteMember({
                  restaurantId,
                  restaurantName,
                  email,
                  roleId,
                  invitedBy: actorUid,
                  branchIds: [],
                });
                setInvites((prev) => [...prev, inv]);
                setEmail("");
                toast("Invitación enviada", "success");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Error", "error");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <Input
            label="Invitar por email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Select
            label="Rol"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value as RoleId)}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Button type="submit" className="self-end" disabled={busy}>
            Invitar
          </Button>
        </form>
      ) : null}
      {branches.length ? (
        <p className="text-xs text-fg-muted">
          {branches.length} sucursal(es) en este tenant. Las restricciones por
          sucursal se aplican en las reglas de Firestore.
        </p>
      ) : null}
    </div>
  );
}

function BillingPanel({
  restaurantId,
  billing,
  invoices,
  canEdit,
}: {
  restaurantId: string;
  billing: ReturnType<typeof useTenant>["billing"];
  invoices: ReturnType<typeof useTenant>["invoices"];
  canEdit: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const currentPlanId = billing
    ? normalizeBillingPlanId(billing.planId)
    : null;
  const plan = currentPlanId ? BILLING_PLANS[currentPlanId] : null;
  const paidPlans = (Object.keys(BILLING_PLANS) as BillingPlanId[]).filter(
    (id) => id !== "trial",
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated p-5">
        <p className="text-caption">Plan actual (solo este restaurante)</p>
        <p className="mt-1 text-title">{plan?.name ?? "—"}</p>
        <p className="mt-1 text-sm text-fg-muted">
          Estado: {billing?.status ?? "—"} ·{" "}
          {billing
            ? `${formatPlanPrice(billing.amountCents)}/mes`
            : ""}
        </p>
        <p className="mt-2 text-xs text-fg-muted">
          Asientos: {billing?.seatsIncluded ?? "—"} · Sucursales:{" "}
          {billing?.branchesIncluded ?? "—"}
          {billing?.trialEndsAt
            ? ` · Prueba hasta ${new Date(billing.trialEndsAt).toLocaleDateString("es-ES")}`
            : ""}
        </p>
      </div>

      {canEdit ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {paidPlans.map((id) => {
            const p = BILLING_PLANS[id];
            const active = currentPlanId === id;
            return (
              <button
                key={id}
                type="button"
                disabled={busy || active}
                onClick={() => {
                  void (async () => {
                    try {
                      setBusy(true);
                      await changePlan({ restaurantId, planId: id });
                      toast(`Plan ${p.name} activado`, "success");
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Error", "error");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                className={`relative rounded-[var(--radius-lg)] border p-4 text-left ${
                  active
                    ? "border-accent bg-accent-soft/40"
                    : p.recommended
                      ? "border-accent/60 bg-accent-soft/20 hover:border-accent"
                      : "border-border hover:border-accent/40"
                }`}
              >
                {p.recommended ? (
                  <span className="absolute right-3 top-3 text-xs font-semibold text-accent">
                    ⭐ Recomendado
                  </span>
                ) : null}
                <p className="font-medium pr-24">{p.name}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-fg">
                  {formatPlanPrice(p.monthlyPriceCents)}
                  <span className="font-normal text-fg-muted">/mes</span>
                </p>
                <p className="mt-2 text-caption">{p.description}</p>
              </button>
            );
          })}
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-medium">Facturas</h3>
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{inv.number}</p>
                <p className="text-caption">
                  {(inv.amountCents / 100).toFixed(2)} {inv.currency} · {inv.status} ·{" "}
                  {new Date(inv.issuedAt).toLocaleDateString("es-ES")}
                </p>
              </div>
              {canEdit && inv.status === "open" ? (
                <Button
                  size="sm"
                  onClick={() =>
                    void markInvoicePaid({
                      restaurantId,
                      invoiceId: inv.id,
                    }).then(() => toast("Factura marcada como pagada", "success"))
                  }
                >
                  Marcar pagada
                </Button>
              ) : null}
            </li>
          ))}
          {!invoices.length ? (
            <li className="text-sm text-fg-muted">Sin facturas aún.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
