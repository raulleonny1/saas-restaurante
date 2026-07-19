"use client";

import { formatCurrency } from "@/lib/format";
import { SEGMENT_LABELS } from "@/modules/customers/domain/segments";
import { useCrm } from "@/modules/customers/context/CrmProvider";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@/ui";
import { useState } from "react";

export function CustomerDetail() {
  const {
    selected,
    history,
    orders,
    loyalty,
    loyaltyTx,
    promos,
    addNote,
    adjustCustomerPoints,
    offerPersonalizedPromo,
    refreshMetrics,
  } = useCrm();
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState("");
  const [pts, setPts] = useState("50");

  if (!selected) {
    return (
      <EmptyState
        title="Selecciona un cliente"
        description="Historial, pedidos, puntos, alergias y promos personalizadas."
      />
    );
  }

  const c = selected;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[var(--radius-xl)] border border-border bg-bg-elevated">
      <header className="border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-title">{c.name}</h2>
            <p className="text-sm text-fg-muted">
              {[c.email, c.phone].filter(Boolean).join(" · ") || "Sin contacto"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="accent">{c.tier ?? "standard"}</Badge>
              {(c.segments ?? []).map((s) => (
                <Badge key={s} tone="neutral">
                  {SEGMENT_LABELS[s]}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                void refreshMetrics()
                  .then(() => toast("Métricas actualizadas", "success"))
                  .catch((e) => toast(e.message, "error"))
              }
            >
              Recalcular
            </Button>
            <Button
              size="sm"
              onClick={() =>
                void offerPersonalizedPromo()
                  .then(() => toast("Promo personalizada creada", "success"))
                  .catch((e) => toast(e.message, "error"))
              }
            >
              Promo personalizada
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="points">Puntos</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="promos">Promos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Valor cliente" value={String(c.valueScore ?? 0)} />
              <Stat label="Puntos" value={String(loyalty?.points ?? c.points)} />
              <Stat label="Visitas" value={String(c.visitCount)} />
              <Stat
                label="Gastado"
                value={formatCurrency(c.totalSpent, "EUR")}
              />
              <Stat
                label="Frecuencia"
                value={
                  c.avgDaysBetweenVisits
                    ? `${c.avgDaysBetweenVisits}d`
                    : "—"
                }
              />
              <Stat
                label="Última visita"
                value={
                  c.lastVisitAt
                    ? new Date(c.lastVisitAt).toLocaleDateString("es-ES")
                    : "—"
                }
              />
              <Stat
                label="Cumpleaños"
                value={c.birthday ?? "—"}
              />
              <Stat
                label="Tier"
                value={loyalty?.tier ?? c.tier ?? "standard"}
              />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="mb-3 flex gap-2">
              <Input
                placeholder="Añadir nota…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                onClick={() =>
                  void addNote(note.trim())
                    .then(() => {
                      toast("Nota guardada", "success");
                      setNote("");
                    })
                    .catch((e) => toast(e.message, "error"))
                }
              >
                Guardar
              </Button>
            </div>
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{h.title}</span>
                    <Badge tone="neutral">{h.type}</Badge>
                  </div>
                  {h.description ? (
                    <p className="text-fg-muted">{h.description}</p>
                  ) : null}
                  <p className="text-caption">
                    {new Date(h.createdAt).toLocaleString("es-ES")}
                  </p>
                </li>
              ))}
              {!history.length ? (
                <p className="text-sm text-fg-muted">Sin historial aún.</p>
              ) : null}
            </ul>
          </TabsContent>

          <TabsContent value="orders">
            <ul className="space-y-2">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">
                      {o.tableName ?? o.id.slice(0, 8)} · {o.channel}
                    </span>
                    <span>{formatCurrency(o.total, o.currency)}</span>
                  </div>
                  <p className="text-caption">
                    {o.status} ·{" "}
                    {new Date(o.paidAt ?? o.updatedAt).toLocaleString("es-ES")}
                  </p>
                  <p className="text-caption">
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                </li>
              ))}
              {!orders.length ? (
                <p className="text-sm text-fg-muted">
                  Sin pedidos vinculados (`customerId` en el pedido).
                </p>
              ) : null}
            </ul>
          </TabsContent>

          <TabsContent value="points">
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <Input
                label="Puntos"
                type="number"
                className="w-28"
                value={pts}
                onChange={(e) => setPts(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() =>
                  void adjustCustomerPoints(Number(pts) || 0, "earn", "Ajuste CRM")
                    .then(() => toast("Puntos añadidos", "success"))
                    .catch((e) => toast(e.message, "error"))
                }
              >
                Sumar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void adjustCustomerPoints(
                    Number(pts) || 0,
                    "redeem",
                    "Canje CRM",
                  )
                    .then(() => toast("Puntos canjeados", "success"))
                    .catch((e) => toast(e.message, "error"))
                }
              >
                Canjear
              </Button>
            </div>
            <p className="mb-3 text-sm">
              Saldo: <strong>{loyalty?.points ?? c.points}</strong> · Lifetime:{" "}
              {loyalty?.lifetimePoints ?? "—"}
            </p>
            <ul className="space-y-2">
              {loyaltyTx.map((t) => (
                <li
                  key={t.id}
                  className="flex justify-between rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {t.type} {t.note ? `· ${t.note}` : ""}
                  </span>
                  <span className={t.points >= 0 ? "text-success" : "text-danger"}>
                    {t.points >= 0 ? "+" : ""}
                    {t.points}
                  </span>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="profile">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Cumpleaños" value={c.birthday ?? "—"} />
              <Field
                label="Alergias"
                value={c.allergies?.length ? c.allergies.join(", ") : "Ninguna"}
              />
              <Field
                label="Preferencias / favoritos"
                value={
                  [
                    ...(c.preferences?.favorites ?? c.favorites ?? []),
                    ...(c.preferences?.dietary ?? []),
                    ...(c.preferences?.notes ?? []),
                  ].join(" · ") || "—"
                }
              />
              <Field
                label="Canal preferido"
                value={c.preferences?.preferredChannel ?? "—"}
              />
              <Field label="Tags" value={c.tags?.join(", ") || "—"} />
              <Field
                label="Marketing"
                value={c.marketingOptIn ? "Opt-in" : "Opt-out"}
              />
              <Field label="Notas" value={c.notes ?? "—"} />
            </dl>
          </TabsContent>

          <TabsContent value="promos">
            <ul className="space-y-2">
              {promos.map((p) => (
                <li
                  key={p.id}
                  className="rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge tone="accent">{p.status}</Badge>
                  </div>
                  <p className="text-fg-muted">{p.message}</p>
                  <p className="text-caption">
                    {p.discountPercent}% · expira{" "}
                    {p.expiresAt
                      ? new Date(p.expiresAt).toLocaleDateString("es-ES")
                      : "—"}
                  </p>
                </li>
              ))}
              {!promos.length ? (
                <p className="text-sm text-fg-muted">
                  Genera una promo personalizada según segmento (cumpleaños,
                  riesgo, VIP…).
                </p>
              ) : null}
            </ul>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-bg-muted px-3 py-3">
      <p className="text-caption">{label}</p>
      <p className="mt-1 text-lg font-medium tracking-tight">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border px-3 py-2">
      <dt className="text-caption">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
