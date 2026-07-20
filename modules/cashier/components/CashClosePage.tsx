"use client";

import { useAuth } from "@/context/AuthProvider";
import { formatCurrency } from "@/lib/format";
import {
  closeCashSession,
  computeExpectedCash,
  openCashSession,
  subscribeCashSessions,
  subscribeOpenCashSession,
} from "@/modules/cashier/services/cash-session.service";
import { usePos } from "@/modules/pos/context/PosProvider";
import type { CashSession } from "@/types/cash-session";
import type { Payment } from "@/types/orders";
import { Alert, Button, Input, toast } from "@/ui";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useRestaurant } from "@/context/RestaurantProvider";

export function CashClosePage() {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();
  const { branchId, currency, ready } = usePos();
  const [session, setSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [floatAmt, setFloatAmt] = useState("50");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    const u1 = subscribeOpenCashSession(restaurantId, branchId, setSession);
    const u2 = subscribeCashSessions(restaurantId, branchId, setHistory);
    return () => {
      u1();
      u2();
    };
  }, [restaurantId, branchId]);

  useEffect(() => {
    if (!restaurantId || !branchId || !session) {
      setPayments([]);
      return;
    }
    void getDocs(
      query(
        collection(getDb(), "restaurants", restaurantId, "payments"),
        where("branchId", "==", branchId),
      ),
    ).then((snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Payment)
        .filter(
          (p) =>
            p.cashSessionId === session.id ||
            (p.paidAt && p.paidAt >= session.openedAt),
        );
      setPayments(rows);
      setCounted(String(computeExpectedCash(session.openingFloat, rows)));
    });
  }, [restaurantId, branchId, session]);

  const expected = useMemo(
    () =>
      session ? computeExpectedCash(session.openingFloat, payments) : 0,
    [session, payments],
  );

  if (!ready) {
    return <p className="p-4 text-sm text-[#8fa08c]">Cargando…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 pb-28">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[#e7efe4]">
          Cierre Z
        </h1>
        <p className="text-sm text-[#8fa08c]">
          Apertura → cobros → arqueo → diferencia
        </p>
      </header>

      {!session ? (
        <section className="space-y-3 rounded-xl border border-white/10 bg-[#152018] p-4">
          <Alert tone="info" title="Caja cerrada">
            Abre una sesión para registrar el fondo y vincular cobros en efectivo.
          </Alert>
          <Input
            label="Fondo de caja (€)"
            type="number"
            min="0"
            step="0.01"
            value={floatAmt}
            onChange={(e) => setFloatAmt(e.target.value)}
          />
          <Button
            disabled={busy || !user || !restaurantId || !branchId}
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  await openCashSession({
                    restaurantId: restaurantId!,
                    branchId: branchId!,
                    uid: user!.uid,
                    name: user!.displayName || user!.email || undefined,
                    openingFloat: Number(floatAmt) || 0,
                    currency,
                  });
                  toast("Caja abierta", "success");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Abrir caja
          </Button>
        </section>
      ) : (
        <section className="space-y-3 rounded-xl border border-emerald-800/40 bg-[#152018] p-4">
          <p className="text-sm text-[#a8b5a4]">
            Abierta {new Date(session.openedAt).toLocaleString("es")} · fondo{" "}
            {formatCurrency(session.openingFloat, currency)}
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border border-white/10 p-2">
              <p className="text-[11px] text-[#8fa08c]">Esperado</p>
              <p className="font-semibold tabular-nums">
                {formatCurrency(expected, currency)}
              </p>
            </div>
            <div className="rounded-md border border-white/10 p-2">
              <p className="text-[11px] text-[#8fa08c]">Tickets / tips</p>
              <p className="font-semibold tabular-nums">
                {payments.filter((p) => p.status === "completed").length} ·{" "}
                {formatCurrency(
                  payments.reduce((s, p) => s + (p.tipAmount || 0), 0),
                  currency,
                )}
              </p>
            </div>
          </div>
          <Input
            label="Efectivo contado (arqueo)"
            type="number"
            min="0"
            step="0.01"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
          <Input
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
          />
          <p className="text-sm">
            Diferencia:{" "}
            <span className="font-semibold tabular-nums">
              {formatCurrency(
                (Number(counted) || 0) - expected,
                currency,
              )}
            </span>
          </p>
          <Button
            disabled={busy || !user || !restaurantId}
            variant="danger"
            onClick={() => {
              void (async () => {
                try {
                  setBusy(true);
                  const closed = await closeCashSession({
                    restaurantId: restaurantId!,
                    session,
                    countedCash: Number(counted) || 0,
                    payments,
                    uid: user!.uid,
                    name: user!.displayName || user!.email || undefined,
                    notes: notes || undefined,
                  });
                  toast(
                    `Z${closed.zNumber ?? ""} cerrado · dif. ${formatCurrency(closed.difference ?? 0, currency)}`,
                    "success",
                  );
                  setNotes("");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Error", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Cerrar Z
          </Button>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8fa08c]">
          Últimos cierres
        </h2>
        <ul className="space-y-2">
          {history
            .filter((s) => s.status === "closed")
            .slice(0, 8)
            .map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm"
              >
                <span className="font-medium">Z{s.zNumber ?? "—"}</span>
                {" · "}
                {s.closedAt
                  ? new Date(s.closedAt).toLocaleString("es")
                  : "—"}
                {" · dif. "}
                {formatCurrency(s.difference ?? 0, currency)}
              </li>
            ))}
          {!history.some((s) => s.status === "closed") ? (
            <li className="text-sm text-[#8fa08c]">Sin cierres aún.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
