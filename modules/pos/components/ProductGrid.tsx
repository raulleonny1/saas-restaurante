"use client";

import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Product } from "@/types/catalog";
import { SearchInput } from "@/ui";
import { useMemo, useState } from "react";
import { ProductCustomizeModal } from "./ProductCustomizeModal";

export function ProductGrid({ disabled }: { disabled?: boolean }) {
  const { products, categories, addProduct, currency } = usePos();
  const [categoryId, setCategoryId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [customizing, setCustomizing] = useState<Product | null>(null);

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
      <SearchInput
        placeholder="Buscar productos…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
      />
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <CatChip
          active={categoryId === "all"}
          onClick={() => setCategoryId("all")}
          label="Todos"
        />
        {categories.map((c) => (
          <CatChip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
            label={c.name}
          />
        ))}
      </div>
      {!filtered.length ? (
        <p className="py-8 text-center text-sm text-fg-muted">
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
              className="min-h-[72px] rounded-[var(--radius-md)] border border-border bg-bg-elevated px-3 py-3 text-left transition-colors hover:border-accent/40 hover:bg-bg-muted disabled:opacity-40"
            >
              <p className="text-sm font-medium leading-snug">{p.name}</p>
              <p className="mt-1 text-caption">
                {formatCurrency(p.price, currency)}
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm ${
        active
          ? "bg-accent text-accent-fg"
          : "bg-bg-muted text-fg-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}
