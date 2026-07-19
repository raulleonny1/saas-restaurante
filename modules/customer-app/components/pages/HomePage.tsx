"use client";

import {
  ACTIVE_ORDER_STATUSES,
  money,
  orderStatusLabel,
} from "@/modules/customer-app/domain/format";
import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";
import Link from "next/link";
import { useMemo } from "react";

export function CustomerHomePage() {
  const {
    slug,
    restaurant,
    loyalty,
    orders,
    reservations,
    promotions,
    personalPromos,
    notifications,
    cart,
    products,
    categories,
  } = useCustomerApp();
  const base = `/c/${slug}`;
  const active = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  const unread = notifications.filter((n) => !n.read).length;
  const nextRes = reservations.find(
    (r) => r.status === "pending" || r.status === "confirmed",
  );

  const offerings = useMemo(() => {
    const groups = categories
      .map((c) => ({
        name: c.name,
        items: products.filter((p) => p.categoryId === c.id).slice(0, 3),
      }))
      .filter((g) => g.items.length)
      .slice(0, 3);
    if (groups.length) return groups;
    if (!products.length) return [];
    return [{ name: "Carta", items: products.slice(0, 6) }];
  }, [categories, products]);

  const links = [
    { href: `${base}/pedidos`, label: "Pedir", hint: cart.length ? `${cart.length} en carrito` : "Carta" },
    { href: `${base}/seguimiento`, label: "Seguimiento", hint: active.length ? `${active.length} activos` : "Sin pedidos" },
    { href: `${base}/reservas`, label: "Reservas", hint: nextRes ? "Próxima reserva" : "Reservar mesa" },
    { href: `${base}/puntos`, label: "Puntos", hint: `${loyalty?.points ?? 0} pts` },
    { href: `${base}/favoritos`, label: "Favoritos", hint: "Tus platos" },
    { href: `${base}/historial`, label: "Historial", hint: "Pedidos pasados" },
    { href: `${base}/promociones`, label: "Promos", hint: `${promotions.length + personalPromos.length}` },
    { href: `${base}/chat`, label: "Chat", hint: "Hablar con el local" },
    { href: `${base}/notificaciones`, label: "Avisos", hint: unread ? `${unread} sin leer` : "Al día" },
  ];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/80">
          Cliente
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {restaurant?.name ?? "Tu app"}
        </h1>
        <p className="mt-1 text-sm text-[#a8b5a4]">
          Carta, reservas y pedidos en un solo sitio.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-[#8fa08c]">Puntos</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {loyalty?.points ?? 0}
          </p>
          <p className="text-xs capitalize text-[#a8b5a4]">
            {loyalty?.tier ?? "standard"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-[#8fa08c]">Pedidos activos</p>
          <p className="mt-1 text-2xl font-semibold">{active.length}</p>
          {active[0] ? (
            <p className="text-xs text-[#a8b5a4]">
              {orderStatusLabel(active[0].status)}
            </p>
          ) : (
            <p className="text-xs text-[#a8b5a4]">Ninguno</p>
          )}
        </div>
      </section>

      {offerings.length ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#e7efe4]">
              Lo que ofrecemos
            </h2>
            <Link
              href={`${base}/pedidos`}
              className="text-xs text-emerald-400 hover:underline"
            >
              Ver carta
            </Link>
          </div>
          {offerings.map((g) => (
            <div key={g.name}>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#8fa08c]">
                {g.name}
              </p>
              <ul className="space-y-1.5">
                {g.items.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-emerald-300">
                      {money(p.price, restaurant?.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex gap-2">
            <Link
              href={`${base}/pedidos`}
              className="flex-1 rounded-xl bg-emerald-700 py-3 text-center text-sm font-semibold"
            >
              Pedir
            </Link>
            <Link
              href={`${base}/reservas`}
              className="flex-1 rounded-xl border border-white/20 py-3 text-center text-sm font-semibold"
            >
              Reservar mesa
            </Link>
          </div>
        </section>
      ) : null}

      {active[0] ? (
        <Link
          href={`${base}/seguimiento`}
          className="block rounded-xl border border-emerald-700/50 bg-emerald-900/30 p-4"
        >
          <p className="text-sm font-medium">Pedido en curso</p>
          <p className="mt-1 text-xs text-[#c5d0c2]">
            {orderStatusLabel(active[0].status)} ·{" "}
            {money(active[0].total, restaurant?.currency)}
          </p>
        </Link>
      ) : null}

      {nextRes ? (
        <Link
          href={`${base}/reservas`}
          className="block rounded-xl border border-violet-500/40 bg-violet-950/30 p-4"
        >
          <p className="text-sm font-medium text-violet-100">Próxima reserva</p>
          <p className="mt-1 text-xs text-[#c5d0c2]">
            {new Date(nextRes.startsAt).toLocaleString("es")}
            {nextRes.tableName ? ` · Mesa ${nextRes.tableName}` : ""} ·{" "}
            {nextRes.partySize} pers.
          </p>
        </Link>
      ) : null}

      <section className="grid grid-cols-3 gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-emerald-700/40"
          >
            <p className="text-sm font-medium">{l.label}</p>
            <p className="mt-1 text-[11px] text-[#8fa08c]">{l.hint}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
