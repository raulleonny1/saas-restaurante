"use client";

import { SEGMENT_LABELS } from "@/modules/customers/domain/segments";
import { useCrm } from "@/modules/customers/context/CrmProvider";
import type { CustomerSegmentId } from "@/types/customers";
import { Badge, SearchInput } from "@/ui";

const FILTERS: Array<CustomerSegmentId | "all"> = [
  "all",
  "vip",
  "high_value",
  "loyal",
  "new",
  "at_risk",
  "dormant",
  "birthday",
  "allergy_watch",
];

export function CustomerList() {
  const {
    filtered,
    query,
    setQuery,
    segmentFilter,
    setSegmentFilter,
    selectedId,
    selectCustomer,
  } = useCrm();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <SearchInput
        placeholder="Nombre, email, teléfono, tag…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
      />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setSegmentFilter(f)}
            className={`shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium ${
              segmentFilter === f
                ? "bg-accent text-accent-fg"
                : "bg-bg-muted text-fg-muted"
            }`}
          >
            {f === "all" ? "Todos" : SEGMENT_LABELS[f]}
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => selectCustomer(c.id)}
              className={`w-full rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors ${
                selectedId === c.id
                  ? "border-accent bg-accent-soft/40"
                  : "border-border hover:bg-bg-muted/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{c.name}</p>
                <span className="text-caption tabular-nums">
                  {c.valueScore ?? 0}
                </span>
              </div>
              <p className="text-caption">
                {c.points} pts · {c.visitCount} visitas · {c.totalSpent.toFixed(0)}€
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(c.segments ?? []).slice(0, 3).map((s) => (
                  <Badge key={s} tone="neutral">
                    {SEGMENT_LABELS[s]}
                  </Badge>
                ))}
                {c.allergies?.length ? (
                  <Badge tone="danger">Alergias</Badge>
                ) : null}
              </div>
            </button>
          </li>
        ))}
        {!filtered.length ? (
          <p className="py-8 text-center text-sm text-fg-muted">
            No hay clientes con este filtro.
          </p>
        ) : null}
      </ul>
    </div>
  );
}
