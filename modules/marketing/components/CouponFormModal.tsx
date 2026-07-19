"use client";

import { SEGMENT_LABELS } from "@/modules/customers/domain/segments";
import { randomCouponCode } from "@/modules/marketing/domain/ids";
import type { CustomerSegmentId } from "@/types/customers";
import type { Coupon } from "@/types/promotions";
import { Button, Input, Modal, Select } from "@/ui";
import { useEffect, useState } from "react";

const SEGMENTS = Object.keys(SEGMENT_LABELS) as CustomerSegmentId[];

export function CouponFormModal({
  open,
  onClose,
  coupon,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  coupon?: Coupon | null;
  onSubmit: (payload: {
    code?: string;
    discountPercent?: number;
    discountAmount?: number;
    active?: boolean;
    startsAt?: string;
    expiresAt?: string;
    usageLimit?: number;
    targetSegments?: CustomerSegmentId[];
  }) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("10");
  const [active, setActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("100");
  const [segments, setSegments] = useState<CustomerSegmentId[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(coupon?.code ?? randomCouponCode());
    setMode(coupon?.discountAmount ? "amount" : "percent");
    setValue(
      String(
        coupon?.discountAmount ?? coupon?.discountPercent ?? 10,
      ),
    );
    setActive(coupon?.active ?? true);
    setExpiresAt(coupon?.expiresAt?.slice(0, 10) ?? "");
    setUsageLimit(coupon?.usageLimit?.toString() ?? "100");
    setSegments(coupon?.targetSegments ?? []);
  }, [open, coupon]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={coupon ? "Editar cupón" : "Nuevo cupón"}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            label="Código"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            className="mt-6"
            onClick={() => setCode(randomCouponCode())}
          >
            Generar
          </Button>
        </div>
        <Select
          label="Tipo de descuento"
          value={mode}
          onChange={(e) => setMode(e.target.value as "percent" | "amount")}
        >
          <option value="percent">Porcentaje</option>
          <option value="amount">Importe fijo (€)</option>
        </Select>
        <Input
          label={mode === "percent" ? "% descuento" : "Importe (€)"}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Input
          label="Caducidad"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <Input
          label="Límite de usos"
          type="number"
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
        />
        <Select
          label="Estado"
          value={active ? "1" : "0"}
          onChange={(e) => setActive(e.target.value === "1")}
        >
          <option value="1">Activo</option>
          <option value="0">Inactivo</option>
        </Select>
        <div>
          <p className="mb-1.5 text-sm text-fg-muted">Segmentos objetivo</p>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENTS.map((s) => {
              const on = segments.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setSegments((prev) =>
                      prev.includes(s)
                        ? prev.filter((x) => x !== s)
                        : [...prev, s],
                    )
                  }
                  className={`rounded-[var(--radius-md)] px-2.5 py-1 text-xs transition ${
                    on
                      ? "bg-accent text-accent-fg"
                      : "bg-bg-muted text-fg-muted"
                  }`}
                >
                  {SEGMENT_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !code.trim()}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await onSubmit({
                    code,
                    discountPercent:
                      mode === "percent" ? Number(value) : undefined,
                    discountAmount:
                      mode === "amount" ? Number(value) : undefined,
                    active,
                    expiresAt: expiresAt
                      ? new Date(`${expiresAt}T23:59:59`).toISOString()
                      : undefined,
                    usageLimit: usageLimit ? Number(usageLimit) : undefined,
                    targetSegments: segments.length ? segments : undefined,
                  });
                  onClose();
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
