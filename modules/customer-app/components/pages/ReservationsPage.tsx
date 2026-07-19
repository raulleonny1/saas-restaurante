"use client";

import { reservationStatusLabel } from "@/modules/customer-app/domain/format";
import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";
import { FormEvent, useState } from "react";

export function CustomerReservationsPage() {
  const { reservations, bookReservation, customer } = useCustomerApp();
  const [partySize, setPartySize] = useState(2);
  const [startsAt, setStartsAt] = useState("");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startsAt) {
      setMsg("Elige fecha y hora");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await bookReservation({
        partySize,
        startsAt,
        customerPhone: phone || undefined,
        notes: notes || undefined,
      });
      setMsg("Reserva enviada. Te confirmaremos pronto.");
      setNotes("");
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
        <p className="text-sm text-[#a8b5a4]">Solicita mesa desde la app.</p>
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
          disabled={busy}
          className="w-full rounded-md bg-emerald-700 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Enviando…" : "Reservar"}
        </button>
        {msg ? <p className="text-xs text-emerald-300">{msg}</p> : null}
      </form>

      <section>
        <h2 className="mb-2 text-sm text-[#8fa08c]">Tus reservas</h2>
        <ul className="space-y-2">
          {reservations.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-white/10 px-3 py-3 text-sm"
            >
              <div className="flex justify-between gap-2">
                <p className="font-medium">
                  {new Date(r.startsAt).toLocaleString("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <span className="text-xs text-[#a8b5a4]">
                  {reservationStatusLabel(r.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#8fa08c]">
                {r.partySize} personas
                {r.notes ? ` · ${r.notes}` : ""}
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
