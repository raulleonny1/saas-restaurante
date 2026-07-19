"use client";

import { usePos } from "@/modules/pos/context/PosProvider";
import { Button, Modal, toast } from "@/ui";
import { useState } from "react";

export function MergeTablesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { tables, activeOrder, mergeWithTables } = usePos();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const candidates = tables.filter((t) => t.id !== activeOrder?.tableId);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Unir mesas"
      description="Combina tickets y marca mesas satélite en el mismo pedido."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!selected.length || busy}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await mergeWithTables(selected);
                  toast("Mesas unidas", "success");
                  setSelected([]);
                  onClose();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Unir
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {candidates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            className={`rounded-[var(--radius-md)] border px-3 py-3 text-sm ${
              selected.includes(t.id)
                ? "border-accent bg-accent-soft"
                : "border-border"
            }`}
          >
            {t.name}
            <span className="mt-1 block text-caption">{t.status}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
