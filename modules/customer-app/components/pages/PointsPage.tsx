"use client";

import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";

export function CustomerPointsPage() {
  const { loyalty, loyaltyTx, customer } = useCustomerApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Puntos
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Tu saldo de fidelización en este local.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-700/40 bg-gradient-to-br from-emerald-950/50 to-transparent p-6">
        <p className="text-xs uppercase tracking-wide text-[#8fa08c]">Saldo</p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-5xl text-emerald-400">
          {loyalty?.points ?? customer?.points ?? 0}
        </p>
        <p className="mt-2 text-sm capitalize text-[#c5d0c2]">
          Nivel {loyalty?.tier ?? customer?.tier ?? "standard"}
        </p>
        <p className="mt-1 text-xs text-[#8fa08c]">
          Histórico: {loyalty?.lifetimePoints ?? 0} pts acumulados
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm text-[#8fa08c]">Movimientos</h2>
        <ul className="space-y-2">
          {loyaltyTx.map((tx) => (
            <li
              key={tx.id}
              className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm"
            >
              <div>
                <p>{tx.note || tx.type}</p>
                <p className="text-[11px] text-[#8fa08c]">
                  {new Date(tx.createdAt).toLocaleString("es-ES")}
                </p>
              </div>
              <span
                className={
                  tx.points >= 0 ? "text-emerald-400" : "text-amber-300"
                }
              >
                {tx.points >= 0 ? "+" : ""}
                {tx.points}
              </span>
            </li>
          ))}
          {!loyaltyTx.length ? (
            <li className="py-6 text-center text-sm text-[#8fa08c]">
              Aún no hay movimientos. Pide y acumula puntos.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
