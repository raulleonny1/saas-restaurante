"use client";

import { money } from "@/modules/customer-app/domain/format";
import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";
import { useState } from "react";

export function CustomerOrdersPage() {
  const {
    products,
    categories,
    restaurant,
    cart,
    cartTotal,
    addToCart,
    setQty,
    placeOrder,
    customer,
    toggleFavorite,
  } = useCustomerApp();
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");

  const favs = new Set(customer?.favorites ?? []);
  const filtered =
    cat === "all"
      ? products
      : products.filter((p) => p.categoryId === cat);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const order = await placeOrder({
        customerPhone: phone || undefined,
        notes: notes || undefined,
      });
      setMsg(`Pedido enviado (#${order.id.slice(-6)})`);
      setNotes("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al pedir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Pedidos
        </h1>
        <p className="text-sm text-[#a8b5a4]">Elige platos y envía a cocina.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setCat("all")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${
            cat === "all" ? "bg-emerald-700" : "border border-white/15"
          }`}
        >
          Todo
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs ${
              cat === c.id ? "bg-emerald-700" : "border border-white/15"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {filtered.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 border-b border-white/10 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-[#8fa08c]">
                {money(p.price, restaurant?.currency)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleFavorite(p.id)}
                className={`text-sm ${favs.has(p.id) ? "text-amber-400" : "text-[#5a6b57]"}`}
                aria-label="Favorito"
              >
                ★
              </button>
              <button
                type="button"
                onClick={() => addToCart(p)}
                className="rounded-md bg-emerald-800 px-3 py-1.5 text-xs"
              >
                Añadir
              </button>
            </div>
          </li>
        ))}
        {!filtered.length ? (
          <li className="py-8 text-center text-sm text-[#8fa08c]">
            No hay productos disponibles.
          </li>
        ) : null}
      </ul>

      {cart.length ? (
        <section className="sticky bottom-4 space-y-3 rounded-xl border border-emerald-700/40 bg-[#152018] p-4 shadow-lg">
          <p className="text-sm font-medium">Carrito</p>
          <ul className="space-y-2 text-sm">
            {cart.map((l) => (
              <li key={l.productId} className="flex items-center justify-between gap-2">
                <span className="truncate">{l.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-6 w-6 rounded border border-white/20"
                    onClick={() => setQty(l.productId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-5 text-center">{l.quantity}</span>
                  <button
                    type="button"
                    className="h-6 w-6 rounded border border-white/20"
                    onClick={() => setQty(l.productId, l.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono (opcional)"
            className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas del pedido"
            rows={2}
            className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="font-semibold">
              {money(cartTotal, restaurant?.currency)}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Enviando…" : "Confirmar pedido"}
            </button>
          </div>
          {msg ? <p className="text-xs text-emerald-300">{msg}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
