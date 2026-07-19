"use client";

import { useCrm } from "@/modules/customers/context/CrmProvider";
import type { Customer } from "@/types/customers";
import { Button, Input, Modal, Textarea, toast } from "@/ui";
import { useEffect, useState } from "react";

export function CustomerFormModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
}) {
  const { saveCustomer, selectCustomer } = useCrm();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [allergies, setAllergies] = useState("");
  const [favorites, setFavorites] = useState("");
  const [prefs, setPrefs] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? "");
    setEmail(customer?.email ?? "");
    setPhone(customer?.phone ?? "");
    setBirthday(customer?.birthday ?? "");
    setAllergies(customer?.allergies?.join(", ") ?? "");
    setFavorites(
      (customer?.preferences?.favorites ?? customer?.favorites ?? []).join(", "),
    );
    setPrefs(customer?.preferences?.notes?.join(", ") ?? "");
    setTags(customer?.tags?.join(", ") ?? "");
    setNotes(customer?.notes ?? "");
  }, [open, customer]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Editar cliente" : "Nuevo cliente"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !name.trim()}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  const fav = favorites
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const saved = await saveCustomer({
                    customer,
                    name,
                    email,
                    phone,
                    birthday: birthday || undefined,
                    allergies: allergies
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    favorites: fav,
                    preferences: {
                      favorites: fav,
                      notes: prefs
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      preferredChannel: "email",
                    },
                    tags: tags
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    notes: notes || undefined,
                    marketingOptIn: true,
                  });
                  selectCustomer(saved.id);
                  toast("Cliente guardado", "success");
                  onClose();
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Cumpleaños"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
        />
        <Input
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Alergias (coma)"
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="gluten, lactosa"
        />
        <Input
          label="Favoritos (coma)"
          value={favorites}
          onChange={(e) => setFavorites(e.target.value)}
        />
        <Input
          label="Preferencias (coma)"
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          placeholder="terraza, leche avena"
        />
        <Input
          label="Tags (coma)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Textarea
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
