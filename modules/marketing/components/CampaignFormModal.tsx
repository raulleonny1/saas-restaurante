"use client";

import { SEGMENT_LABELS } from "@/modules/customers/domain/segments";
import { CHANNELS, CHANNEL_LABELS } from "@/modules/marketing/domain/channels";
import { useMarketing } from "@/modules/marketing/context/MarketingProvider";
import type { CustomerSegmentId } from "@/types/customers";
import type { AudienceFilter, Campaign, CampaignChannel } from "@/types/promotions";
import { Button, Input, Modal, Select, Textarea } from "@/ui";
import { useEffect, useMemo, useState } from "react";

const SEGMENTS = Object.keys(SEGMENT_LABELS) as CustomerSegmentId[];

export function CampaignFormModal({
  open,
  onClose,
  campaign,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  campaign?: Campaign | null;
  onSubmit: (payload: {
    name: string;
    channel: CampaignChannel;
    subject?: string;
    body: string;
    audienceFilter?: AudienceFilter;
    couponId?: string;
    promotionId?: string;
    scheduledAt?: string;
    status?: Campaign["status"];
    sendNow: boolean;
  }) => Promise<void>;
}) {
  const { previewAudience, coupons, promotions } = useMarketing();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(
    "Hola {{name}}, tenemos una oferta especial para ti. ¡Te esperamos!",
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [segments, setSegments] = useState<CustomerSegmentId[]>([]);
  const [minPoints, setMinPoints] = useState("");
  const [couponId, setCouponId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(campaign?.name ?? "");
    setChannel(campaign?.channel ?? "email");
    setSubject(campaign?.subject ?? "");
    setBody(
      campaign?.body ??
        "Hola {{name}}, tenemos una oferta especial para ti. ¡Te esperamos!",
    );
    setScheduledAt(campaign?.scheduledAt?.slice(0, 16) ?? "");
    setSegments(campaign?.audienceFilter?.segments ?? []);
    setMinPoints(campaign?.audienceFilter?.minPoints?.toString() ?? "");
    setCouponId(campaign?.couponId ?? "");
    setPromotionId(campaign?.promotionId ?? "");
  }, [open, campaign]);

  const filter: AudienceFilter = useMemo(
    () => ({
      segments: segments.length ? segments : undefined,
      minPoints: minPoints ? Number(minPoints) : undefined,
      marketingOptInOnly: true,
    }),
    [segments, minPoints],
  );

  const audienceSize = previewAudience(channel, filter);

  const submit = async (sendNow: boolean) => {
    setBusy(true);
    try {
      const scheduledIso = scheduledAt
        ? new Date(scheduledAt).toISOString()
        : undefined;
      await onSubmit({
        name,
        channel,
        subject: subject || undefined,
        body,
        audienceFilter: filter,
        couponId: couponId || undefined,
        promotionId: promotionId || undefined,
        scheduledAt: sendNow ? undefined : scheduledIso,
        status: sendNow ? "draft" : scheduledIso ? "scheduled" : "draft",
        sendNow,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={campaign ? "Editar campaña" : "Nueva campaña"}
      description="Email, SMS, WhatsApp, Push o in-app. Usa {{name}} en el texto."
      size="lg"
    >
      <div className="space-y-3">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Select
          label="Canal"
          value={channel}
          onChange={(e) => setChannel(e.target.value as CampaignChannel)}
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </Select>
        {(channel === "email" || channel === "push" || channel === "in_app") && (
          <Input
            label="Asunto"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        )}
        <Textarea
          label="Mensaje"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
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
        <Input
          label="Puntos mínimos (opcional)"
          type="number"
          value={minPoints}
          onChange={(e) => setMinPoints(e.target.value)}
        />
        <Select
          label="Cupón vinculado"
          value={couponId}
          onChange={(e) => setCouponId(e.target.value)}
        >
          <option value="">Ninguno</option>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </Select>
        <Select
          label="Promoción vinculada"
          value={promotionId}
          onChange={(e) => setPromotionId(e.target.value)}
        >
          <option value="">Ninguna</option>
          {promotions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input
          label="Programar envío (opcional)"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <p className="text-sm text-fg-muted">
          Audiencia estimada: <span className="font-medium text-fg">{audienceSize}</span>{" "}
          contactos (opt-in + canal válido)
        </p>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !name.trim() || !body.trim()}
            onClick={() => void submit(false)}
          >
            Guardar
          </Button>
          <Button
            disabled={busy || !name.trim() || !body.trim()}
            onClick={() => void submit(true)}
          >
            Enviar ahora
          </Button>
        </div>
      </div>
    </Modal>
  );
}
