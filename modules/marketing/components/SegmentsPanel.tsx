"use client";

import { SEGMENT_LABELS } from "@/modules/customers/domain/segments";
import { CHANNELS, CHANNEL_LABELS } from "@/modules/marketing/domain/channels";
import { useMarketing } from "@/modules/marketing/context/MarketingProvider";
import type { CustomerSegmentId } from "@/types/customers";
import type { CampaignChannel } from "@/types/promotions";
import { Badge, Select } from "@/ui";
import { useMemo, useState } from "react";

const SEGMENTS = Object.keys(SEGMENT_LABELS) as CustomerSegmentId[];

export function SegmentsPanel() {
  const { customers, segmentCounts, previewAudience } = useMarketing();
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [selected, setSelected] = useState<CustomerSegmentId[]>([]);

  const reachable = useMemo(
    () =>
      previewAudience(channel, {
        segments: selected.length ? selected : undefined,
        marketingOptInOnly: true,
      }),
    [channel, selected, previewAudience],
  );

  const optIn = customers.filter((c) => c.marketingOptIn).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Clientes CRM" value={customers.length} />
        <Stat label="Opt-in marketing" value={optIn} />
        <Stat label="Alcanzables (filtro)" value={reachable} accent />
      </div>

      <div className="space-y-3">
        <p className="text-sm text-fg-muted">
          Tamaños de segmento (un cliente puede estar en varios).
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SEGMENTS.map((s) => {
            const on = selected.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(s)
                      ? prev.filter((x) => x !== s)
                      : [...prev, s],
                  )
                }
                className={`flex items-center justify-between rounded-[var(--radius-lg)] border px-3 py-3 text-left transition ${
                  on
                    ? "border-accent bg-accent/10"
                    : "border-border bg-bg-elevated hover:border-accent/40"
                }`}
              >
                <span className="text-sm font-medium text-fg">
                  {SEGMENT_LABELS[s]}
                </span>
                <Badge tone={on ? "accent" : "neutral"}>
                  {segmentCounts[s] ?? 0}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-xs">
        <Select
          label="Canal para estimar alcance"
          value={channel}
          onChange={(e) => setChannel(e.target.value as CampaignChannel)}
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-bg-elevated px-4 py-3">
      <p className="text-caption text-fg-muted">{label}</p>
      <p
        className={`mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums ${
          accent ? "text-accent" : "text-fg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
