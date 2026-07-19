"use client";

import { SEGMENT_LABELS } from "@/modules/customers/domain/segments";
import type { CustomerSegmentId } from "@/types/customers";
import type { Promotion, PromotionStatus, PromotionType } from "@/types/promotions";
import { Button, Input, Modal, Select, Textarea } from "@/ui";
import { useEffect, useState } from "react";

const TYPES: { id: PromotionType; label: string }[] = [
  { id: "percent_off", label: "% descuento" },
  { id: "fixed_off", label: "Importe fijo" },
  { id: "bogo", label: "2x1 / BOGO" },
  { id: "happy_hour", label: "Happy hour" },
  { id: "points_multiplier", label: "Multiplicador puntos" },
];

const STATUSES: { id: PromotionStatus; label: string }[] = [
  { id: "draft", label: "Borrador" },
  { id: "scheduled", label: "Programada" },
  { id: "active", label: "Activa" },
  { id: "disabled", label: "Desactivada" },
];

const SEGMENTS = Object.keys(SEGMENT_LABELS) as CustomerSegmentId[];

function toLocalDate(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function PromotionFormModal({
  open,
  onClose,
  promotion,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  promotion?: Promotion | null;
  onSubmit: (payload: {
    name: string;
    type: PromotionType;
    status: PromotionStatus;
    percentOff?: number;
    amountOff?: number;
    startsAt: string;
    endsAt: string;
    usageLimit?: number;
    stackable?: boolean;
    targetSegments?: string[];
    personalizedMessage?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PromotionType>("percent_off");
  const [status, setStatus] = useState<PromotionStatus>("active");
  const [value, setValue] = useState("15");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [stackable, setStackable] = useState(false);
  const [message, setMessage] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 14);
    setName(promotion?.name ?? "");
    setType(promotion?.type ?? "percent_off");
    setStatus(promotion?.status ?? "active");
    setValue(
      String(promotion?.percentOff ?? promotion?.amountOff ?? 15),
    );
    setStartsAt(toLocalDate(promotion?.startsAt) || today.toISOString().slice(0, 10));
    setEndsAt(toLocalDate(promotion?.endsAt) || end.toISOString().slice(0, 10));
    setUsageLimit(promotion?.usageLimit?.toString() ?? "");
    setStackable(promotion?.stackable ?? false);
    setMessage(promotion?.personalizedMessage ?? "");
    setSegments(promotion?.targetSegments ?? []);
  }, [open, promotion]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={promotion ? "Editar promoción" : "Nueva promoción"}
      size="lg"
    >
      <div className="space-y-3">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Tipo"
            value={type}
            onChange={(e) => setType(e.target.value as PromotionType)}
          >
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select
            label="Estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as PromotionStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        {(type === "percent_off" || type === "points_multiplier") && (
          <Input
            label={type === "percent_off" ? "% descuento" : "Multiplicador"}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {type === "fixed_off" && (
          <Input
            label="Importe (€)"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Inicio"
            type="date"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <Input
            label="Fin"
            type="date"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
        <Input
          label="Límite de usos (opcional)"
          type="number"
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
        />
        <Select
          label="Apilable"
          value={stackable ? "1" : "0"}
          onChange={(e) => setStackable(e.target.value === "1")}
        >
          <option value="0">No</option>
          <option value="1">Sí</option>
        </Select>
        <Textarea
          label="Mensaje"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div>
          <p className="mb-1.5 text-sm text-fg-muted">Segmentos</p>
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
            disabled={busy || !name.trim() || !startsAt || !endsAt}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await onSubmit({
                    name,
                    type,
                    status,
                    percentOff:
                      type === "percent_off" || type === "points_multiplier"
                        ? Number(value)
                        : undefined,
                    amountOff:
                      type === "fixed_off" ? Number(value) : undefined,
                    startsAt: new Date(`${startsAt}T00:00:00`).toISOString(),
                    endsAt: new Date(`${endsAt}T23:59:59`).toISOString(),
                    usageLimit: usageLimit ? Number(usageLimit) : undefined,
                    stackable,
                    targetSegments: segments,
                    personalizedMessage: message || undefined,
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
