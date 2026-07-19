"use client";

import type { ReportPeriodPreset } from "@/modules/reports/domain/period";
import { Button, Input } from "@/ui";

const PRESETS: { id: ReportPeriodPreset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "custom", label: "Custom" },
];

export function PeriodControls({
  preset,
  onPreset,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
}: {
  preset: ReportPeriodPreset;
  onPreset: (p: ReportPeriodPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={preset === p.id ? "primary" : "secondary"}
            onClick={() => onPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            label="Desde"
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="w-[150px]"
          />
          <Input
            type="date"
            label="Hasta"
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            className="w-[150px]"
          />
        </div>
      ) : null}
    </div>
  );
}
