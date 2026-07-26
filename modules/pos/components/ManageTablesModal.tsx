"use client";

import { useAuth } from "@/context/AuthProvider";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { FloorZone } from "@/modules/pos/services/tables.service";
import type { Table } from "@/types/orders";
import { Button, Input, Modal, Select, toast } from "@/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ZONES: { id: FloorZone; label: string }[] = [
  { id: "sala", label: "Sala (mesas)" },
  { id: "barra", label: "Barra / bar" },
  { id: "vip", label: "VIP" },
  { id: "terraza", label: "Terraza" },
];

function zoneLabel(zone?: string | null): string {
  const z = ZONES.find((x) => x.id === zone);
  return z?.label ?? zone ?? "Sala";
}

function nextIndexForPrefix(tables: Table[], prefix: RegExp): number {
  let max = 0;
  for (const t of tables) {
    const m = t.name.trim().match(prefix);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}

export function ManageTablesModal({
  open,
  onClose,
  initialTab = "cantidad",
}: {
  open: boolean;
  onClose: () => void;
  /** cantidad = crear por lotes; una = alta individual */
  initialTab?: "cantidad" | "una";
}) {
  const { can } = useAuth();
  const {
    tables,
    branchId,
    createFloorTable,
    createFloorTablesBatch,
    updateFloorTable,
    removeFloorTable,
  } = usePos();
  const canManage = can("tables.manage");

  const [tab, setTab] = useState<"cantidad" | "una">(initialTab);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("4");
  const [zone, setZone] = useState<FloorZone>("sala");
  const [editing, setEditing] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const [qtyMesas, setQtyMesas] = useState("10");
  const [qtyBares, setQtyBares] = useState("2");
  const [qtyVip, setQtyVip] = useState("2");
  const [qtyTerraza, setQtyTerraza] = useState("0");
  const [seatsMesa, setSeatsMesa] = useState("4");
  const [seatsBar, setSeatsBar] = useState("2");
  const [seatsVip, setSeatsVip] = useState("6");
  const [seatsTerraza, setSeatsTerraza] = useState("4");

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setName("");
      setSeats("4");
      setZone("sala");
      setLastSaved(null);
      setBusy(false);
      return;
    }
    setTab(initialTab);
  }, [open, initialTab]);

  const counts = useMemo(() => {
    const active = tables.filter((t) => !t.deletedAt);
    const by = (z: FloorZone) =>
      active.filter((t) => (t.zone ?? "sala") === z).length;
    return {
      total: active.length,
      sala: by("sala"),
      barra: by("barra"),
      vip: by("vip"),
      terraza: by("terraza"),
    };
  }, [tables]);

  function startEdit(t: Table) {
    setTab("una");
    setEditing(t);
    setName(t.name);
    setSeats(String(t.seats));
    const z = t.zone as FloorZone | undefined;
    setZone(
      z === "barra" || z === "terraza" || z === "sala" || z === "vip"
        ? z
        : "sala",
    );
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setSeats("4");
    setZone("sala");
  }

  async function onSaveOne() {
    const seatsN = Number(seats);
    if (!name.trim()) {
      toast("Pon un nombre (ej. M9, Barra 2 o VIP 1)", "error");
      return;
    }
    if (!Number.isFinite(seatsN) || seatsN < 1) {
      toast("Los asientos deben ser al menos 1", "error");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateFloorTable({
          tableId: editing.id,
          name,
          seats: seatsN,
          zone,
        });
        toast("Actualizado", "success");
      } else {
        await createFloorTable({ name, seats: seatsN, zone });
        toast("Creado", "success");
      }
      resetForm();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateBatch() {
    if (!branchId) {
      toast(
        "Sin sucursal cargada. Cierra el modal, espera un segundo y vuelve a abrir.",
        "error",
      );
      return;
    }

    const batches: {
      qty: number;
      seats: number;
      zone: FloorZone;
      prefix: string;
      re: RegExp;
    }[] = [
      {
        qty: Math.max(0, Math.min(80, Math.floor(Number(qtyMesas) || 0))),
        seats: Math.max(1, Math.floor(Number(seatsMesa) || 4)),
        zone: "sala",
        prefix: "Mesa",
        re: /^mesa\s*(\d+)$/i,
      },
      {
        qty: Math.max(0, Math.min(40, Math.floor(Number(qtyBares) || 0))),
        seats: Math.max(1, Math.floor(Number(seatsBar) || 2)),
        zone: "barra",
        prefix: "Barra",
        re: /^barra\s*(\d+)$/i,
      },
      {
        qty: Math.max(0, Math.min(40, Math.floor(Number(qtyVip) || 0))),
        seats: Math.max(1, Math.floor(Number(seatsVip) || 6)),
        zone: "vip",
        prefix: "VIP",
        re: /^vip\s*(\d+)$/i,
      },
      {
        qty: Math.max(0, Math.min(40, Math.floor(Number(qtyTerraza) || 0))),
        seats: Math.max(1, Math.floor(Number(seatsTerraza) || 4)),
        zone: "terraza",
        prefix: "Terraza",
        re: /^terraza\s*(\d+)$/i,
      },
    ];

    const total = batches.reduce((s, b) => s + b.qty, 0);
    if (total < 1) {
      toast("Indica al menos 1 mesa, bar, VIP o terraza", "error");
      return;
    }

    setBusy(true);
    setLastSaved(null);
    try {
      const snapshot = tables.filter((t) => !t.deletedAt);
      const drafts: {
        name: string;
        seats: number;
        zone: FloorZone;
      }[] = [];
      for (const batch of batches) {
        if (!batch.qty) continue;
        const start = nextIndexForPrefix(snapshot, batch.re);
        for (let i = 0; i < batch.qty; i++) {
          drafts.push({
            name: `${batch.prefix} ${start + i}`,
            seats: batch.seats,
            zone: batch.zone,
          });
        }
      }
      const created = await createFloorTablesBatch(drafts);
      setLastSaved(created.length);
      toast(
        created.length === 1
          ? "1 sitio guardado en Firebase"
          : `${created.length} sitios guardados en Firebase`,
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error al guardar", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mesas, bares y VIP"
      description="Se guardan en Firebase. El Camarero los verá en sala al instante."
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {lastSaved != null ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Guardado: {lastSaved} sitio{lastSaved === 1 ? "" : "s"} en Firebase
            </p>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            {lastSaved != null ? (
              <Button type="button" onClick={onClose}>
                Aceptar
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {!canManage ? (
        <p className="text-sm text-fg-muted">
          Tu rol no puede gestionar mesas (`tables.manage`). Pide al propietario
          o gerente.
        </p>
      ) : !branchId ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Cargando sucursal… espera un momento y vuelve a abrir este panel.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ["Total", counts.total],
                ["Mesas", counts.sala],
                ["Bares", counts.barra],
                ["VIP", counts.vip],
                ["Terraza", counts.terraza],
              ] as const
            ).map(([label, n]) => (
              <div
                key={label}
                className="rounded-[var(--radius-md)] border border-border bg-bg-muted/40 px-3 py-2 text-center"
              >
                <p className="text-lg font-semibold tabular-nums">{n}</p>
                <p className="text-[11px] text-fg-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setTab("cantidad")}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === "cantidad"
                  ? "bg-accent text-white"
                  : "text-fg-muted hover:bg-bg-muted"
              }`}
            >
              Crear por cantidad
            </button>
            <button
              type="button"
              onClick={() => setTab("una")}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === "una"
                  ? "bg-accent text-white"
                  : "text-fg-muted hover:bg-bg-muted"
              }`}
            >
              Una a una
            </button>
          </div>

          {tab === "cantidad" ? (
            <div className="space-y-4">
              <p className="text-sm text-fg-muted">
                Indica cuántos quieres añadir ahora. Se numeran solos (Mesa 1,
                Barra 1, VIP 1…) sin pisar los que ya existen.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[var(--radius-md)] border border-border p-3 space-y-2">
                  <p className="text-sm font-medium">Mesas de sala</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Cantidad"
                      type="number"
                      min={0}
                      max={80}
                      value={qtyMesas}
                      onChange={(e) => setQtyMesas(e.target.value)}
                    />
                    <Input
                      label="Asientos c/u"
                      type="number"
                      min={1}
                      max={50}
                      value={seatsMesa}
                      onChange={(e) => setSeatsMesa(e.target.value)}
                    />
                  </div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-border p-3 space-y-2">
                  <p className="text-sm font-medium">Bares / barras</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Cantidad"
                      type="number"
                      min={0}
                      max={40}
                      value={qtyBares}
                      onChange={(e) => setQtyBares(e.target.value)}
                    />
                    <Input
                      label="Asientos c/u"
                      type="number"
                      min={1}
                      max={50}
                      value={seatsBar}
                      onChange={(e) => setSeatsBar(e.target.value)}
                    />
                  </div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-border p-3 space-y-2">
                  <p className="text-sm font-medium">Sitios VIP</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Cantidad"
                      type="number"
                      min={0}
                      max={40}
                      value={qtyVip}
                      onChange={(e) => setQtyVip(e.target.value)}
                    />
                    <Input
                      label="Asientos c/u"
                      type="number"
                      min={1}
                      max={50}
                      value={seatsVip}
                      onChange={(e) => setSeatsVip(e.target.value)}
                    />
                  </div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-border p-3 space-y-2">
                  <p className="text-sm font-medium">Terraza (opcional)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Cantidad"
                      type="number"
                      min={0}
                      max={40}
                      value={qtyTerraza}
                      onChange={(e) => setQtyTerraza(e.target.value)}
                    />
                    <Input
                      label="Asientos c/u"
                      type="number"
                      min={1}
                      max={50}
                      value={seatsTerraza}
                      onChange={(e) => setSeatsTerraza(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <Button
                type="button"
                disabled={busy || !branchId}
                onClick={() => void onCreateBatch()}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                {busy ? "Guardando en Firebase…" : "Guardar en Firebase"}
              </Button>
              <p className="text-xs text-fg-muted">
                Esto <strong>añade</strong> sitios nuevos (no borra los que ya
                hay). Ej.: si ya tienes Mesa 1–10 y pones 2, se crean Mesa 11 y
                12.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_100px_150px_auto]">
                <Input
                  label="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mesa 9 / Barra 2 / VIP 1"
                />
                <Input
                  label="Asientos"
                  type="number"
                  min={1}
                  max={50}
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                />
                <Select
                  label="Zona"
                  value={zone}
                  onChange={(e) => setZone(e.target.value as FloorZone)}
                >
                  {ZONES.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label}
                    </option>
                  ))}
                </Select>
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    disabled={busy || !branchId}
                    onClick={() => void onSaveOne()}
                  >
                    {editing ? (
                      <>
                        <Pencil className="h-3.5 w-3.5" /> Guardar
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Añadir
                      </>
                    )}
                  </Button>
                  {editing ? (
                    <Button type="button" variant="secondary" onClick={resetForm}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <ul className="max-h-[280px] space-y-2 overflow-y-auto border-t border-border pt-4">
            {tables.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-caption">
                    {t.seats} asientos · {zoneLabel(t.zone)} · {t.status}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={
                      busy ||
                      t.status === "occupied" ||
                      Boolean(t.currentOrderId)
                    }
                    onClick={() => {
                      if (
                        !window.confirm(
                          `¿Eliminar «${t.name}» del plano?`,
                        )
                      ) {
                        return;
                      }
                      setBusy(true);
                      void removeFloorTable(t.id)
                        .then(() => toast("Eliminado", "success"))
                        .catch((e) =>
                          toast(
                            e instanceof Error ? e.message : "Error",
                            "error",
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
            {!tables.length ? (
              <li className="py-6 text-center text-sm text-fg-muted">
                Aún no hay sitios. Usa «Crear por cantidad» arriba.
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </Modal>
  );
}
