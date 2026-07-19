"use client";

import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Product } from "@/types/catalog";
import { SearchInput } from "@/ui";
import { useMemo, useState } from "react";
import { ProductCustomizeModal } from "./ProductCustomizeModal";

export function ProductGrid({
  disabled,
  /** Sala meseros: contraste alto sobre fondo oscuro. */
  tone = "default",
}: {
  disabled?: boolean;
  tone?: "default" | "waiter";
}) {
  const { products, categories, addProduct, currency } = usePos();
  const [categoryId, setCategoryId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [customizing, setCustomizing] = useState<Product | null>(null);
  const waiter = tone === "waiter";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== "all" && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [products, categoryId, query]);

  const onPick = async (product: Product) => {
    if (disabled) return;
    const needsCustomize =
      (product.variants?.length ?? 0) > 0 ||
      (product.modifierGroups?.length ?? 0) > 0;
    if (needsCustomize) {
      setCustomizing(product);
      return;
    }
    try {
      await addProduct({ product });
    } catch (e) {
      const { toast } = await import("@/ui");
      toast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div
        className={
          waiter
            ? "[&_input]:border-white/20 [&_input]:bg-[#1a241c] [&_input]:text-[#e7efe4] [&_input]:placeholder:text-[#8fa08c] [&_svg]:text-[#8fa08c]"
            : undefined
        }
      >
        <SearchInput
          placeholder="Buscar productos…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <CatChip
          active={categoryId === "all"}
          onClick={() => setCategoryId("all")}
          label="Todos"
          waiter={waiter}
        />
        {categories.map((c) => (
          <CatChip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
            label={c.name}
            waiter={waiter}
          />
        ))}
      </div>
      {!filtered.length ? (
        <p
          className={`py-8 text-center text-sm ${
            waiter ? "text-[#8fa08c]" : "text-fg-muted"
          }`}
        >
          No hay productos. Prepara la carta en Firestore o usa «Preparar POS».
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => void onPick(p)}
              className={
                waiter
                  ? "min-h-[72px] rounded-xl border border-white/20 bg-[#1a241c] px-3 py-3 text-left text-[#e7efe4] transition-colors hover:border-emerald-500/50 hover:bg-[#243028] disabled:opacity-40"
                  : "min-h-[72px] rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3 py-3 text-left text-fg transition-colors hover:border-accent/40 hover:bg-bg-muted disabled:opacity-40"
              }
            >
              <p className="text-sm font-medium leading-snug text-inherit">
                {p.name}
              </p>
              {p.brand ? (
                <p
                  className={
                    waiter
                      ? "text-[11px] text-[#8fa08c]"
                      : "text-caption text-fg-muted"
                  }
                >
                  {p.brand}
                </p>
              ) : null}
              <p
                className={
                  waiter
                    ? "mt-1 text-xs font-medium text-emerald-300"
                    : "mt-1 text-caption text-fg-muted"
                }
              >
                {formatCurrency(p.price, currency)}
                {p.wholesalePrice != null
                  ? ` · mayor ${formatCurrency(p.wholesalePrice, currency)}`
                  : ""}
              </p>
            </button>
          ))}
        </div>
      )}
      <ProductCustomizeModal
        product={customizing}
        open={Boolean(customizing)}
        onClose={() => setCustomizing(null)}
      />
    </div>
  );
}

function CatChip({
  label,
  active,
  onClick,
  waiter,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  waiter?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm ${
        active
          ? waiter
            ? "bg-emerald-700 text-white"
            : "bg-accent text-accent-fg"
          : waiter
            ? "border border-white/15 bg-[#1a241c] text-[#c5d0c2]"
            : "bg-bg-muted text-fg-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}
