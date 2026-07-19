"use client";

import { useReservations } from "@/modules/reservations/context/ReservationsProvider";
import { ReservationFloor } from "@/modules/reservations/components/ReservationFloor";
import { Button, Input, Switch, Textarea, toast } from "@/ui";
import { useState } from "react";

export function ReservationForm() {
  const {
    slotStart,
    setSlotStart,
    durationMinutes,
    setDurationMinutes,
    autoAssign,
    setAutoAssign,
    createBooking,
    addToWaitlist,
  } = useReservations();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [notes, setNotes] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setPartySize("2");
    setNotes("");
    setTableId(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Fecha y hora"
          type="datetime-local"
          value={slotStart}
          onChange={(e) => setSlotStart(e.target.value)}
        />
        <Input
          label="Duración (min)"
          type="number"
          min={30}
          step={15}
          value={String(durationMinutes)}
          onChange={(e) => setDurationMinutes(Number(e.target.value) || 90)}
        />
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Comensales"
          type="number"
          min={1}
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Textarea
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 sm:col-span-2">
          <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
          <span className="text-sm">Asignación automática de mesa</span>
        </label>
      </div>

      {!autoAssign ? (
        <ReservationFloor
          selectedTableId={tableId}
          onSelectTable={setTableId}
        />
      ) : (
        <ReservationFloor
          selectedTableId={null}
          onSelectTable={() => undefined}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !name.trim()}
          onClick={() => {
            void (async () => {
              try {
                setBusy(true);
                await createBooking({
                  customerName: name,
                  customerPhone: phone || undefined,
                  customerEmail: email || undefined,
                  partySize: Number(partySize) || 2,
                  tableId: autoAssign ? null : tableId,
                  notes: notes || undefined,
                });
                toast("Reserva creada", "success");
                reset();
              } catch (e) {
                toast(e instanceof Error ? e.message : "Error", "error");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Crear reserva
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !name.trim()}
          onClick={() => {
            void (async () => {
              try {
                setBusy(true);
                await addToWaitlist({
                  customerName: name,
                  customerPhone: phone || undefined,
                  partySize: Number(partySize) || 2,
                  notes: notes || undefined,
                });
                toast("Añadido a lista de espera", "success");
                reset();
              } catch (e) {
                toast(e instanceof Error ? e.message : "Error", "error");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Lista de espera
        </Button>
      </div>
    </div>
  );
}
