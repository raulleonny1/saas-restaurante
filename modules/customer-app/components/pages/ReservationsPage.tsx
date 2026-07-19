"use client";

import { reservationStatusLabel } from "@/modules/customer-app/domain/format";
import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";
import { addMinutes } from "@/modules/reservations/domain/time";
import type { PublicBookingSlot } from "@/modules/reservations/domain/publicSlot";
import {
  availableTablesForSlot,
  subscribePublicBookingSlots,
  subscribePublicTables,
} from "@/modules/reservations/services/public-slots.service";
import type { Table } from "@/types/orders";
import { FormEvent, useEffect, useMemo, useState } from "react";

export function CustomerReservationsPage() {
  const { reservations, bookReservation, customer, restaurant, branches } =
    useCustomerApp();
  const [partySize, setPartySize] = useState(2);
  const [startsAt, setStartsAt] = useState("");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tableId, setTableId] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [slots, setSlots] = useState<PublicBookingSlot[]>([]);

  const branchId =
    branches.find((b) => b.isDefault)?.id ?? branches[0]?.id ?? "";
  const duration = 90;

  useEffect(() => {
    if (!restaurant?.id) return;
    const u1 = subscribePublicTables(restaurant.id, setTables);
    const u2 = subscribePublicBookingSlots(restaurant.id, setSlots);
    return () => {
      u1();
      u2();
    };
  }, [restaurant?.id]);

  const freeTables = useMemo(() => {
    if (!startsAt || !branchId) return [] as Table[];
    const startIso = new Date(startsAt).toISOString();
    return availableTablesForSlot({
      tables,
      slots,
      branchId,
      partySize,
      startsAt: startIso,
      endsAt: addMinutes(startIso, duration),
    });
  }, [startsAt, branchId, tables, slots, partySize]);

  useEffect(() => {
    if (tableId && !freeTables.some((t) => t.id === tableId)) {
      setTableId("");
    }
  }, [freeTables, tableId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startsAt) {
      setMsg("Elige fecha y hora");
      return;
    }
    if (!freeTables.length) {
      setMsg("No hay mesas libres en ese horario");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const picked =
        freeTables.find((t) => t.id === tableId) ?? freeTables[0]!;
      await bookReservation({
        partySize,
        startsAt,
        customerPhone: phone || undefined,
        notes: notes || undefined,
        tableId: picked.id,
        tableName: picked.name,
        durationMinutes: duration,
      });
      setMsg(`Reserva enviada · mesa ${picked.name}`);
      setNotes("");
      setStartsAt("");
      setTableId("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error al reservar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Reservas
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Elige mesa libre; el local lo ve en tiempo real.
        </p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4"
      >
        <label className="block text-xs text-[#8fa08c]">
          Comensales
          <input
            type="number"
            min={1}
            max={20}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value) || 1)}
            className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-[#e7efe4]"
          />
        </label>
        <label className="block text-xs text-[#8fa08c]">
          Fecha y hora
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-[#e7efe4]"
          />
        </label>

        {startsAt ? (
          <div className="space-y-2">
            <p className="text-xs text-[#8fa08c]">
              Mesas libres ({freeTables.length})
            </p>
            {!freeTables.length ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
                Sin mesas para ese horario. Prueba otra hora.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {freeTables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTableId(t.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                      tableId === t.id
                        ? "border-emerald-500 bg-emerald-950/40"
                        : "border-white/15"
                    }`}
                  >
                    <p className="font-medium">{t.name}</p>
                    <p className="text-[11px] text-[#8fa08c]">
                      {t.seats} asientos
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <label className="block text-xs text-[#8fa08c]">
          Teléfono
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-[#e7efe4]"
          />
        </label>
        <label className="block text-xs text-[#8fa08c]">
          Notas
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-[#e7efe4]"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !startsAt || freeTables.length === 0}
          className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Enviando…" : "Confirmar reserva"}
        </button>
        {msg ? <p className="text-center text-xs text-emerald-300">{msg}</p> : null}
      </form>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[#c5d0c2]">Tus reservas</h2>
        <ul className="space-y-2">
          {reservations.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-white/10 px-3 py-2.5 text-sm"
            >
              <p className="font-medium">
                {new Date(r.startsAt).toLocaleString("es")}
              </p>
              <p className="mt-0.5 text-xs text-[#8fa08c]">
                {reservationStatusLabel(r.status)} · {r.partySize} pers.
                {r.tableName ? ` · Mesa ${r.tableName}` : ""}
              </p>
            </li>
          ))}
          {!reservations.length ? (
            <li className="py-6 text-center text-sm text-[#8fa08c]">
              Aún no tienes reservas.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
