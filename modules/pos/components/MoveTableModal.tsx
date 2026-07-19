"use client";

import { usePos } from "@/modules/pos/context/PosProvider";
import { Button, Modal, toast } from "@/ui";
import { useState } from "react";

export function MoveTableModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { tables, activeOrder, moveToTable } = usePos();
  const [targetId, setTargetId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const candidates = tables.filter(
    (t) =>
      t.id !== activeOrder?.tableId &&
      (t.status === "available" || t.status === "dirty"),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambiar de mesa"
      description="Mueve el ticket actual a otra mesa libre."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!targetId || busy}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await moveToTable(targetId);
                  toast("Mesa cambiada", "success");
                  onClose();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Mover
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {candidates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTargetId(t.id)}
            className={`rounded-[var(--radius-md)] border px-3 py-3 text-sm ${
              targetId === t.id
                ? "border-accent bg-accent-soft"
                : "border-border"
            }`}
          >
            {t.name}
          </button>
        ))}
        {!candidates.length ? (
          <p className="col-span-3 text-sm text-fg-muted">
            No hay mesas libres.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
