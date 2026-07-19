"use client";

import { CHANNELS, CHANNEL_LABELS } from "@/modules/marketing/domain/channels";
import { AUTOMATION_TRIGGER_LABELS } from "@/modules/marketing/services/automations.service";
import type {
  AutomationTrigger,
  CampaignChannel,
  MarketingAutomation,
} from "@/types/promotions";
import { Button, Input, Modal, Select, Textarea } from "@/ui";
import { useEffect, useState } from "react";

const TRIGGERS = Object.keys(AUTOMATION_TRIGGER_LABELS) as AutomationTrigger[];

export function AutomationFormModal({
  open,
  onClose,
  automation,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  automation?: MarketingAutomation | null;
  onSubmit: (payload: {
    name: string;
    enabled: boolean;
    trigger: AutomationTrigger;
    channel: CampaignChannel;
    subject?: string;
    body: string;
    cooldownDays?: number;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [trigger, setTrigger] = useState<AutomationTrigger>("birthday");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(
    "Hola {{name}}, pensamos en ti. Vuelve pronto con una oferta especial.",
  );
  const [cooldownDays, setCooldownDays] = useState("30");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(automation?.name ?? "");
    setEnabled(automation?.enabled ?? true);
    setTrigger(automation?.trigger ?? "birthday");
    setChannel(automation?.channel ?? "email");
    setSubject(automation?.subject ?? "");
    setBody(
      automation?.body ??
        "Hola {{name}}, pensamos en ti. Vuelve pronto con una oferta especial.",
    );
    setCooldownDays(String(automation?.cooldownDays ?? 30));
  }, [open, automation]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={automation ? "Editar automatización" : "Nueva automatización"}
      description="Se ejecuta en segundo plano (cada ~6 h) mientras la app esté abierta."
      size="lg"
    >
      <div className="space-y-3">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="Disparador"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}
        >
          {TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {AUTOMATION_TRIGGER_LABELS[t]}
            </option>
          ))}
        </Select>
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
        <Input
          label="Asunto (email / push)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          label="Mensaje"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Input
          label="Cooldown (días)"
          type="number"
          value={cooldownDays}
          onChange={(e) => setCooldownDays(e.target.value)}
        />
        <Select
          label="Estado"
          value={enabled ? "1" : "0"}
          onChange={(e) => setEnabled(e.target.value === "1")}
        >
          <option value="1">Activa</option>
          <option value="0">Pausada</option>
        </Select>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !name.trim() || !body.trim()}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await onSubmit({
                    name,
                    enabled,
                    trigger,
                    channel,
                    subject: subject || undefined,
                    body,
                    cooldownDays: Number(cooldownDays) || 30,
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
