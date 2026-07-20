"use client";

import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import type { Employee, EmployeeShift } from "@/types/employees";
import { Alert, Badge, Button, toast } from "@/ui";
import { useMemo, useState } from "react";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayLabel(d: Date) {
  return d.toLocaleDateString("es", { weekday: "short", day: "numeric" });
}

function overlaps(a: EmployeeShift, b: EmployeeShift) {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

function shiftHours(s: EmployeeShift) {
  return (
    (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) /
    (1000 * 60 * 60)
  );
}

/**
 * Vista semanal de turnos + detección de solapes + plantilla +7d (Fase 6).
 */
export function WeeklyShiftsPanel({
  onAddShift,
}: {
  onAddShift?: () => void;
}) {
  const { shifts, employees, saveShift } = useEmployees();
  const [weekOffset, setWeekOffset] = useState(0);
  const [busy, setBusy] = useState(false);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const empById = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const weekShifts = useMemo(() => {
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    return shifts.filter((s) => s.startsAt < to && s.endsAt > from);
  }, [shifts, weekStart]);

  const overlapIds = useMemo(() => {
    const bad = new Set<string>();
    for (let i = 0; i < weekShifts.length; i++) {
      for (let j = i + 1; j < weekShifts.length; j++) {
        const a = weekShifts[i];
        const b = weekShifts[j];
        if (a.employeeId === b.employeeId && overlaps(a, b)) {
          bad.add(a.id);
          bad.add(b.id);
        }
      }
    }
    return bad;
  }, [weekShifts]);

  const totalHours = useMemo(
    () => weekShifts.reduce((s, sh) => s + shiftHours(sh), 0),
    [weekShifts],
  );

  async function copyWeekAsTemplate() {
    if (!weekShifts.length) {
      toast("No hay turnos esta semana para copiar", "info");
      return;
    }
    setBusy(true);
    try {
      const msWeek = 7 * 24 * 60 * 60 * 1000;
      for (const s of weekShifts) {
        await saveShift({
          branchId: s.branchId,
          employeeId: s.employeeId,
          startsAt: new Date(new Date(s.startsAt).getTime() + msWeek).toISOString(),
          endsAt: new Date(new Date(s.endsAt).getTime() + msWeek).toISOString(),
          roleId: s.roleId,
          notes: s.notes ? `${s.notes} (plantilla)` : "Plantilla semanal",
        });
      }
      toast(`${weekShifts.length} turnos copiados a la semana siguiente`, "success");
      setWeekOffset((w) => w + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Turnos semanales</h3>
          <p className="text-caption text-fg-muted">
            {totalHours.toFixed(1)} h programadas · solapes resaltados
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            ← Semana
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>
            Hoy
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            Semana →
          </Button>
          {onAddShift ? (
            <Button size="sm" onClick={onAddShift}>
              Nuevo turno
            </Button>
          ) : null}
        </div>
      </div>

      {overlapIds.size ? (
        <Alert tone="warning" title="Solapes detectados">
          {overlapIds.size} turnos se solapan para el mismo empleado.
        </Alert>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d) => {
          const dayFrom = d.toISOString();
          const dayTo = addDays(d, 1).toISOString();
          const list = weekShifts.filter(
            (s) => s.startsAt < dayTo && s.endsAt > dayFrom,
          );
          return (
            <div
              key={dayFrom}
              className="min-h-[120px] rounded-md border border-border bg-bg-muted/30 p-2"
            >
              <p className="mb-2 text-xs font-semibold capitalize">
                {dayLabel(d)}
              </p>
              <ul className="space-y-1">
                {list.map((s) => {
                  const emp = empById.get(s.employeeId);
                  const clash = overlapIds.has(s.id);
                  const start = new Date(s.startsAt).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const end = new Date(s.endsAt).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li
                      key={s.id}
                      className={`rounded px-1.5 py-1 text-[11px] ${
                        clash
                          ? "bg-[var(--warning-soft)] text-warning"
                          : "bg-bg text-fg"
                      }`}
                    >
                      <span className="font-medium">
                        {emp?.name?.split(" ")[0] ?? "—"}
                      </span>
                      <span className="block tabular-nums text-fg-muted">
                        {start}–{end}
                      </span>
                      {clash ? (
                        <Badge tone="warning" className="mt-0.5">
                          Solape
                        </Badge>
                      ) : null}
                    </li>
                  );
                })}
                {!list.length ? (
                  <li className="text-[11px] text-fg-muted">Sin turnos</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>

      <Button
        size="sm"
        variant="secondary"
        disabled={busy || !weekShifts.length}
        onClick={() => void copyWeekAsTemplate()}
      >
        {busy ? "Copiando…" : "Plantilla → semana siguiente"}
      </Button>
    </div>
  );
}
