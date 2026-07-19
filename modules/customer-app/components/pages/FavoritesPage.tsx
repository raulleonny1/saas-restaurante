"use client";

import { money } from "@/modules/customer-app/domain/format";
import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";

export function CustomerFavoritesPage() {
  const {
    products,
    customer,
    restaurant,
    toggleFavorite,
    addToCart,
  } = useCustomerApp();
  const favIds = customer?.favorites ?? [];
  const favProducts = products.filter((p) => favIds.includes(p.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Favoritos
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Platos guardados para pedir más rápido.
        </p>
      </div>

      <ul className="space-y-2">
        {favProducts.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-3"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-[#8fa08c]">
                {money(p.price, restaurant?.currency)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addToCart(p)}
                className="rounded-md bg-emerald-800 px-3 py-1.5 text-xs"
              >
                Pedir
              </button>
              <button
                type="button"
                onClick={() => void toggleFavorite(p.id)}
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-amber-400"
              >
                Quitar
              </button>
            </div>
          </li>
        ))}
        {!favProducts.length ? (
          <li className="py-10 text-center text-sm text-[#8fa08c]">
            Marca ★ en Pedidos para guardar favoritos.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
