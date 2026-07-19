"use client";

import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Product, ProductModifierOption } from "@/types/catalog";
import type { OrderItemModifier } from "@/types/orders";
import { Button, Modal, Textarea, toast } from "@/ui";
import { useEffect, useState } from "react";

export function ProductCustomizeModal({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  const { addProduct, currency } = usePos();
  const [variantId, setVariantId] = useState<string | undefined>();
  const [selectedMods, setSelectedMods] = useState<Record<string, string[]>>(
    {},
  );
  const [kitchenNotes, setKitchenNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setVariantId(product.variants?.[0]?.id);
    setSelectedMods({});
    setKitchenNotes("");
  }, [open, product]);

  if (!product) return null;

  const toggleMod = (groupId: string, option: ProductModifierOption, max = 1) => {
    setSelectedMods((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(option.id)) {
        return { ...prev, [groupId]: current.filter((id) => id !== option.id) };
      }
      const next =
        max <= 1 ? [option.id] : [...current, option.id].slice(-max);
      return { ...prev, [groupId]: next };
    });
  };

  const buildModifiers = (): OrderItemModifier[] => {
    const mods: OrderItemModifier[] = [];
    for (const group of product.modifierGroups ?? []) {
      for (const optId of selectedMods[group.id] ?? []) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) {
          mods.push({
            id: opt.id,
            groupId: group.id,
            name: opt.name,
            priceDelta: opt.priceDelta,
          });
        }
      }
    }
    return mods;
  };

  const validate = () => {
    for (const group of product.modifierGroups ?? []) {
      const count = (selectedMods[group.id] ?? []).length;
      if (group.required || (group.min ?? 0) > 0) {
        if (count < (group.min ?? 1)) {
          throw new Error(`Selecciona: ${group.name}`);
        }
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product.name}
      description={formatCurrency(product.price, currency)}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  validate();
                  await addProduct({
                    product,
                    variantId,
                    modifiers: buildModifiers(),
                    kitchenNotes: kitchenNotes.trim() || undefined,
                  });
                  onClose();
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "No se pudo añadir",
                    "error",
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Añadir al ticket
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {product.variants?.length ? (
          <div>
            <p className="mb-2 text-sm text-fg-muted">Variante</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={`rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                    variantId === v.id
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-bg-elevated"
                  }`}
                >
                  {v.name}
                  {v.priceDelta
                    ? ` (+${formatCurrency(v.priceDelta, currency)})`
                    : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {(product.modifierGroups ?? []).map((group) => (
          <div key={group.id}>
            <p className="mb-2 text-sm text-fg-muted">
              {group.name}
              {group.required ? " *" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((opt) => {
                const on = (selectedMods[group.id] ?? []).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleMod(group.id, opt, group.max ?? 1)}
                    className={`rounded-[var(--radius-md)] border px-3 py-2 text-sm ${
                      on
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-bg-elevated"
                    }`}
                  >
                    {opt.name}
                    {opt.priceDelta
                      ? ` (+${formatCurrency(opt.priceDelta, currency)})`
                      : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <Textarea
          label="Notas para cocina"
          value={kitchenNotes}
          onChange={(e) => setKitchenNotes(e.target.value)}
          placeholder="Sin cebolla, poco hecho…"
        />
      </div>
    </Modal>
  );
}
