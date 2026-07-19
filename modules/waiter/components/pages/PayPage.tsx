"use client";

import { useAuth } from "@/context/AuthProvider";
import { formatCurrency } from "@/lib/format";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { PaymentMethod } from "@/types/orders";
import Link from "next/link";
import { useState } from "react";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "sumup", label: "SumUp" },
  { id: "stripe", label: "Stripe" },
  { id: "other", label: "Otro" },
];

export function WaiterPayPage() {
  const { can } = useAuth();
  const {
    activeOrder,
    balance,
    currency,
    pay,
    printReceipt,
    selectedTableId,
  } = usePos();
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState("0");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const allowed = can("payments.charge");
  const due = balance;
  const payAmount = amount === "" ? due : Number(amount) || 0;

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-sm text-[#e7efe4]">
        <p className="font-medium">Sin permiso de cobro</p>
        <p className="mt-2 text-[#a8b5a4]">
          Tu rol (p. ej. mesero) no incluye `payments.charge`. Pide a un cajero
          o gerente.
        </p>
        <Link href="/waiter/pedido" className="mt-4 inline-block text-emerald-400">
          Volver al pedido
        </Link>
      </div>
    );
  }

  if (!selectedTableId || !activeOrder) {
    return (
      <div className="py-10 text-center text-sm text-[#a8b5a4]">
        Selecciona una mesa con ticket abierto.{" "}
        <Link href="/waiter" className="text-emerald-400">
          Ir a mesas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">
          Cobrar
        </h1>
        <p className="text-sm text-[#a8b5a4]">
          Mesa {activeOrder.tableName} · total{" "}
          {formatCurrency(activeOrder.total, currency)}
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-[#8fa08c]">
          Pendiente
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-4xl text-emerald-300">
          {formatCurrency(due, currency)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`rounded-xl border py-3 text-xs ${
              method === m.id
                ? "border-emerald-500 bg-emerald-900/40"
                : "border-white/15"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <label className="block text-xs text-[#8fa08c]">
        Importe
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          placeholder={String(due)}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-3 text-base text-[#e7efe4]"
        />
      </label>
      <label className="block text-xs text-[#8fa08c]">
        Propina extra
        <input
          type="number"
          inputMode="decimal"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/15 bg-transparent px-3 py-3 text-base text-[#e7efe4]"
        />
      </label>

      <button
        type="button"
        disabled={busy || due <= 0}
        onClick={() => {
          void (async () => {
            try {
              setBusy(true);
              setMsg(null);
              await pay(method, payAmount, Number(tip) || 0);
              try {
                await printReceipt();
              } catch {
                /* optional */
              }
              setMsg("Cobro registrado");
              setAmount("");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Error al cobrar");
            } finally {
              setBusy(false);
            }
          })();
        }}
        className="w-full rounded-xl bg-emerald-700 py-4 text-base font-semibold disabled:opacity-50"
      >
        {busy ? "Cobrando…" : `Cobrar ${formatCurrency(payAmount, currency)}`}
      </button>
      {msg ? <p className="text-center text-sm text-emerald-300">{msg}</p> : null}
    </div>
  );
}
