"use client";

import { useAuth } from "@/context/AuthProvider";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Table } from "@/types/orders";
import { Button, Input, Modal, Select, toast } from "@/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const ZONES = [
  { id: "sala", label: "Sala" },
  { id: "barra", label: "Barra" },
  { id: "terraza", label: "Terraza" },
] as const;

export function ManageTablesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { can } = useAuth();
  const {
    tables,
    createFloorTable,
    updateFloorTable,
    removeFloorTable,
  } = usePos();
  const canManage = can("tables.manage");

  const [name, setName] = useState("");
  const [seats, setSeats] = useState("4");
  const [zone, setZone] = useState<(typeof ZONES)[number]["id"]>("sala");
  const [editing, setEditing] = useState<Table | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setName("");
      setSeats("4");
      setZone("sala");
    }
  }, [open]);

  function startEdit(t: Table) {
    setEditing(t);
    setName(t.name);
    setSeats(String(t.seats));
    setZone(
      t.zone === "barra" || t.zone === "terraza" || t.zone === "sala"
        ? t.zone
        : "sala",
    );
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setSeats("4");
    setZone("sala");
  }

  async function onSave() {
    const seatsN = Number(seats);
    if (!name.trim()) {
      toast("Pon un nombre (ej. M9 o Barra 2)", "error");
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
        toast("Mesa actualizada", "success");
      } else {
        await createFloorTable({ name, seats: seatsN, zone });
        toast("Mesa creada", "success");
      }
      resetForm();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Gestionar mesas y barras"
      description="Crea o elimina mesas de la sucursal. El mesero las verá en /waiter."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      {!canManage ? (
        <p className="text-sm text-fg-muted">
          Tu rol no puede gestionar mesas (`tables.manage`). Pide al dueño o
          supervisor.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_100px_140px_auto]">
            <Input
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="M9 / Barra / Terraza 1"
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
              onChange={(e) =>
                setZone(e.target.value as (typeof ZONES)[number]["id"])
              }
            >
              {ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </Select>
            <div className="flex items-end gap-2">
              <Button disabled={busy} onClick={() => void onSave()}>
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
                <Button variant="secondary" onClick={resetForm}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </div>

          <ul className="max-h-[320px] space-y-2 overflow-y-auto">
            {tables.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-caption">
                    {t.seats} asientos · {t.zone ?? "sala"} · {t.status}
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
                    disabled={busy || t.status === "occupied" || Boolean(t.currentOrderId)}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `¿Eliminar la mesa «${t.name}» del plano?`,
                        )
                      ) {
                        return;
                      }
                      setBusy(true);
                      void removeFloorTable(t.id)
                        .then(() => toast("Mesa eliminada", "success"))
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
                No hay mesas. Añade la primera arriba.
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </Modal>
  );
}
