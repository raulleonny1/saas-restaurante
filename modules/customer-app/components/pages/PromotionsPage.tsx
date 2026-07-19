"use client";

import { useCustomerApp } from "@/modules/customer-app/context/CustomerAppProvider";

function promoDetail(p: {
  type: string;
  percentOff?: number;
  amountOff?: number;
}): string {
  if (p.type === "percent_off" && p.percentOff != null) {
    return `${p.percentOff}% dto.`;
  }
  if (p.type === "fixed_off" && p.amountOff != null) {
    return `${p.amountOff} dto.`;
  }
  if (p.type === "happy_hour") return "Happy hour";
  if (p.type === "bogo") return "2x1 / BOGO";
  if (p.type === "points_multiplier") return "Multiplicador de puntos";
  return p.type;
}

export function CustomerPromotionsPage() {
  const { promotions, personalPromos } = useCustomerApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Promociones
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Ofertas del local y promociones para ti.
        </p>
      </div>

      {personalPromos.length ? (
        <section className="space-y-2">
          <h2 className="text-sm text-emerald-400">Para ti</h2>
          {personalPromos.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4"
            >
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-sm text-[#c5d0c2]">{p.message}</p>
              {(p.discountPercent || p.discountAmount) && (
                <p className="mt-2 text-xs text-emerald-300">
                  {p.discountPercent
                    ? `${p.discountPercent}%`
                    : `${p.discountAmount} €`}{" "}
                  dto.
                </p>
              )}
            </article>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm text-[#8fa08c]">Del restaurante</h2>
        {promotions.map((p) => (
          <article
            key={p.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex justify-between gap-2">
              <p className="font-medium">{p.name}</p>
              <span className="text-[11px] text-[#8fa08c]">{p.status}</span>
            </div>
            <p className="mt-1 text-sm text-[#a8b5a4]">{promoDetail(p)}</p>
            {p.personalizedMessage ? (
              <p className="mt-2 text-xs text-[#8fa08c]">
                {p.personalizedMessage}
              </p>
            ) : null}
          </article>
        ))}
        {!promotions.length && !personalPromos.length ? (
          <p className="py-8 text-center text-sm text-[#8fa08c]">
            No hay promociones activas ahora.
          </p>
        ) : null}
      </section>
    </div>
  );
}
