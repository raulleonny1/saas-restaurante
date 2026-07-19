"use client";

import { useTenant } from "@/context/TenantProvider";
import { ROLE_LABELS } from "@/lib/roles";
import { useEmployees } from "@/modules/employees/context/EmployeesProvider";
import { Badge, SearchInput } from "@/ui";
import { useMemo, useState } from "react";

export function EmployeeList() {
  const {
    employees,
    archivedEmployees,
    listMode,
    selectedId,
    selectEmployee,
  } = useEmployees();
  const { branches } = useTenant();
  const [q, setQ] = useState("");

  const source = listMode === "history" ? archivedEmployees : employees;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return source;
    return source.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term) ||
        (ROLE_LABELS[e.roleId] ?? e.roleId).toLowerCase().includes(term),
    );
  }, [source, q]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[var(--radius-xl)] border border-border bg-bg-elevated">
      <div className="border-b border-border p-3">
        <SearchInput
          placeholder={
            listMode === "history"
              ? "Buscar en historial…"
              : "Buscar empleado…"
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
        />
        {listMode === "history" ? (
          <p className="mt-2 text-[11px] text-fg-muted">
            Empleados eliminados del equipo. Siguen guardados para consulta.
          </p>
        ) : null}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {filtered.map((e) => {
          const branchNames = e.branchIds
            .map((id) => branches.find((b) => b.id === id)?.name)
            .filter(Boolean)
            .join(", ");
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => selectEmployee(e.id)}
                className={`mb-1 w-full rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition ${
                  selectedId === e.id
                    ? "border-accent bg-accent-soft/40"
                    : "border-transparent hover:bg-bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{e.name}</p>
                  <Badge
                    tone={
                      e.deletedAt
                        ? "neutral"
                        : e.status === "active"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {e.deletedAt ? "historial" : e.status}
                  </Badge>
                </div>
                <p className="text-caption">
                  {ROLE_LABELS[e.roleId] ?? e.roleId} · {e.email}
                </p>
                {branchNames ? (
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    {branchNames}
                  </p>
                ) : null}
                {e.deletedAt ? (
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    Eliminado:{" "}
                    {new Date(e.deletedAt).toLocaleDateString("es-ES")}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
        {!filtered.length ? (
          <li className="px-3 py-10 text-center text-sm text-fg-muted">
            {listMode === "history"
              ? "No hay empleados en el historial."
              : "No hay empleados. Crea uno o importa desde membresías."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
