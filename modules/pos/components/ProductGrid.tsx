"use client";

import { formatCurrency } from "@/lib/format";
import {
  getProductAvailability,
  soldOutLabel,
} from "@/modules/inventory/domain/availability";
import {
  categoryTone,
  categoryToneStyle,
} from "@/modules/pos/domain/categoryTone";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { Product } from "@/types/catalog";
import { SearchInput } from "@/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCustomizeModal } from "./ProductCustomizeModal";

export function ProductGrid({
  disabled,
  /** Sala meseros: contraste alto sobre fondo oscuro. */
  tone = "default",
}: {
  disabled?: boolean;
  tone?: "default" | "waiter";
}) {
  const { products, categories, addProduct, currency, inventoryLevels } =
    usePos();
  const [categoryId, setCategoryId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [customizing, setCustomizing] = useState<Product | null>(null);
  const waiter = tone === "waiter";
  const scanBuf = useRef("");
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== "all" && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [products, categoryId, query]);

  const onPick = async (product: Product) => {
    if (disabled) return;
    const avail = getProductAvailability(product, inventoryLevels);
    if (!avail.available) {
      const { toast } = await import("@/ui");
      toast(soldOutLabel(avail.reason), "info");
      return;
    }
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

  /** Escáner HID: lee código de barras y busca por sku/barcode. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Enter") {
        const code = scanBuf.current.trim();
        scanBuf.current = "";
        if (code.length < 3) return;
        const match = products.find(
          (p) =>
            p.sku === code ||
            p.barcode === code ||
            p.sku?.toLowerCase() === code.toLowerCase() ||
            p.barcode?.toLowerCase() === code.toLowerCase(),
        );
        if (match) void onPick(match);
        return;
      }
      if (e.key.length === 1) {
        scanBuf.current += e.key;
        if (scanTimer.current) clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
          scanBuf.current = "";
        }, 80);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (scanTimer.current) clearTimeout(scanTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onPick uses latest products via closure refresh
  }, [products, inventoryLevels, disabled]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div
        className={
          waiter
            ? "[&_input]:min-h-12 [&_input]:border-white/20 [&_input]:bg-[#1a241c] [&_input]:text-[#e7efe4] [&_input]:placeholder:text-[#8fa08c] [&_svg]:text-[#8fa08c]"
            : undefined
        }
      >
        <SearchInput
          placeholder="Buscar productos o escanear…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />
      </div>
      <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-1 [scrollbar-width:thin]">
        <CatChip
          active={categoryId === "all"}
          onClick={() => setCategoryId("all")}
          label="Todos"
          categoryId="all"
        />
        {categories.map((c) => (
          <CatChip
            key={c.id}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
            label={c.name}
            categoryId={c.id}
            categoryName={c.name}
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const catName = categoryNameById.get(p.categoryId);
            const style = categoryToneStyle(p.categoryId, {
              categoryName: catName,
            });
            const toneColors = categoryTone(p.categoryId, catName);
            const avail = getProductAvailability(p, inventoryLevels);
            const unavailable = !avail.available;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled || unavailable}
                onClick={() => void onPick(p)}
                style={style}
                className={`relative flex min-h-[92px] touch-manipulation flex-col justify-between rounded-xl border-2 px-3 py-3 text-left shadow-sm transition-[transform,filter] active:scale-[0.97] active:brightness-110 disabled:opacity-40 ${
                  unavailable ? "grayscale-[0.4]" : ""
                }`}
              >
                {unavailable ? (
                  <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {soldOutLabel(avail.reason)}
                  </span>
                ) : null}
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">
                    {p.name}
                  </p>
                  {p.brand ? (
                    <p
                      className="mt-0.5 truncate text-[11px] opacity-80"
                      style={{ color: toneColors.fg }}
                    >
                      {p.brand}
                    </p>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-bold tabular-nums tracking-tight">
                  {formatCurrency(p.price, currency)}
                </p>
              </button>
            );
          })}
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
  categoryId,
  categoryName,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  categoryId: string;
  categoryName?: string;
}) {
  const style = categoryToneStyle(categoryId, {
    active,
    categoryName,
  });
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`shrink-0 touch-manipulation rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-[transform,filter] active:scale-[0.97] ${
        active ? "ring-2 ring-white/40 ring-offset-1 ring-offset-transparent" : "opacity-90"
      }`}
    >
      {label}
    </button>
  );
}
