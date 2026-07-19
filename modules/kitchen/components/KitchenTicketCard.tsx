"use client";

import { cn } from "@/lib/cn";
import { useKitchen } from "@/modules/kitchen/context/KitchenProvider";
import {
  PRIORITY_STYLES,
  formatElapsed,
} from "@/modules/kitchen/domain/priority";
import type { KitchenColumnId, KitchenTicket } from "@/types/kitchen";
import { Badge, Button, toast } from "@/ui";
import { BellRing } from "lucide-react";
import { useState } from "react";

const NEXT: Partial<Record<KitchenColumnId, KitchenColumnId>> = {
  queued: "preparing",
  preparing: "ready",
  ready: "delivered",
};

const NEXT_LABEL: Partial<Record<KitchenColumnId, string>> = {
  queued: "Preparar",
  preparing: "Listo",
  ready: "Entregar",
};

const PREV: Partial<Record<KitchenColumnId, KitchenColumnId>> = {
  preparing: "queued",
  ready: "preparing",
  delivered: "ready",
};

export function KitchenTicketCard({
  ticket,
  column,
}: {
  ticket: KitchenTicket;
  column: KitchenColumnId;
}) {
  const { moveTicketItems, moveItem, alertWaiter } = useKitchen();
  const style = PRIORITY_STYLES[ticket.priority];
  const next = NEXT[column];
  const prev = PREV[column];
  const itemIds = ticket.items.map((i) => i.item.id);
  const [pingBusy, setPingBusy] = useState(false);
  const canAlertWaiter = column !== "delivered";

  const advance = async (to: KitchenColumnId) => {
    try {
      await moveTicketItems(ticket.order.id, itemIds, to);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  const pingWaiter = async () => {
    try {
      setPingBusy(true);
      await alertWaiter(ticket.order.id, itemIds);
      toast(
        `Mesero avisado · ${ticket.order.tableName ?? "mesa"}`,
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setPingBusy(false);
    }
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border shadow-[var(--shadow-sm)]",
        style.card,
      )}
    >
      <div className={cn("h-1.5 w-full", style.bar)} />
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight">
              {ticket.order.tableName ?? "Sin mesa"}
            </p>
            <p className="text-caption">
              #{ticket.order.id.slice(0, 8)} · {ticket.order.channel}
            </p>
          </div>
          <div className="text-right">
            <Badge
              tone={
                ticket.priority === "normal"
                  ? "success"
                  : ticket.priority === "warning"
                    ? "warning"
                    : "danger"
              }
            >
              {style.label}
            </Badge>
            <p className="mt-1 font-mono text-sm tabular-nums">
              {formatElapsed(ticket.elapsedMs)}
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {ticket.items.map((row) => (
            <li
              key={row.item.id}
              className="rounded-[var(--radius-sm)] bg-bg-elevated/70 px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  <span className="text-accent">{row.item.quantity}×</span>{" "}
                  {row.item.name}
                  {row.item.variantName ? ` · ${row.item.variantName}` : ""}
                </p>
                <span className="shrink-0 font-mono text-caption tabular-nums">
                  {formatElapsed(row.elapsedMs)}
                  <span className="text-fg-muted">
                    /{Math.round(row.targetPrepMs / 60000)}m
                  </span>
                </span>
              </div>
              {row.item.modifiers?.length ? (
                <p className="mt-0.5 text-caption">
                  {row.item.modifiers.map((m) => m.name).join(", ")}
                </p>
              ) : null}
              {row.item.kitchenNotes || row.item.notes ? (
                <p className="mt-1 text-sm font-medium text-warning">
                  {row.item.kitchenNotes || row.item.notes}
                </p>
              ) : null}
              {next ? (
                <button
                  type="button"
                  className="mt-1 text-caption text-accent hover:underline"
                  onClick={() =>
                    void moveItem(ticket.order.id, row.item.id, next).catch(
                      (e) => toast(e.message, "error"),
                    )
                  }
                >
                  Solo esta línea →
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {canAlertWaiter ? (
          <Button
            size="sm"
            variant="secondary"
            className="w-full border-cyan-500/40 bg-cyan-500/10 text-cyan-900 hover:bg-cyan-500/20 dark:text-cyan-100"
            disabled={pingBusy}
            onClick={() => void pingWaiter()}
          >
            <BellRing className="h-3.5 w-3.5" />
            {pingBusy
              ? "Avisando…"
              : `Avisar mesero · ${ticket.order.tableName ?? "mesa"}`}
          </Button>
        ) : null}

        <div className="flex gap-2">
          {prev ? (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => void advance(prev)}
            >
              Atrás
            </Button>
          ) : null}
          {next ? (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => void advance(next)}
            >
              {NEXT_LABEL[column]}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
