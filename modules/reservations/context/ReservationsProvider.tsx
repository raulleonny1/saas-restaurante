"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  getBranchPref,
  pickAllowedBranchId,
  setBranchPref,
} from "@/lib/session-prefs";
import {
  addMinutes,
  endOfDay,
  fromLocalInputValue,
  startOfDay,
} from "@/modules/reservations/domain/time";
import {
  autoAssignReservation,
  createReservation,
  markConfirmationSent,
  markReminderSent,
  reservationsDueForReminder,
  subscribeReservations,
  updateReservationStatus,
} from "@/modules/reservations/services/reservations.service";
import { subscribeReservationTables } from "@/modules/reservations/services/tables.service";
import {
  addWaitlistEntry,
  cancelWaitlistEntry,
  seatFromWaitlist,
  subscribeWaitlist,
} from "@/modules/reservations/services/waitlist.service";
import type { Table } from "@/types/orders";
import type {
  Reservation,
  ReservationStatus,
  WaitlistEntry,
} from "@/types/reservations";
import type { Branch } from "@/types/restaurant";
import { collection, onSnapshot } from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface ReservationsContextValue {
  ready: boolean;
  error: string | null;
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string) => void;
  tables: Table[];
  reservations: Reservation[];
  waitlist: WaitlistEntry[];
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  dayReservations: Reservation[];
  slotStart: string;
  setSlotStart: (local: string) => void;
  durationMinutes: number;
  setDurationMinutes: (n: number) => void;
  autoAssign: boolean;
  setAutoAssign: (v: boolean) => void;
  restaurantName: string;
  createBooking: (input: {
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    partySize: number;
    tableId?: string | null;
    notes?: string;
  }) => Promise<Reservation>;
  setStatus: (r: Reservation, status: ReservationStatus) => Promise<void>;
  confirmReservation: (r: Reservation) => Promise<void>;
  sendReminder: (r: Reservation) => Promise<void>;
  runAutoAssign: (r: Reservation) => Promise<void>;
  addToWaitlist: (input: {
    customerName: string;
    customerPhone?: string;
    partySize: number;
    notes?: string;
  }) => Promise<void>;
  bookFromWaitlist: (entry: WaitlistEntry) => Promise<void>;
  removeWaitlist: (id: string) => Promise<void>;
  dueReminders: Reservation[];
  processDueReminders: () => Promise<number>;
}

const ReservationsContext =
  createContext<ReservationsContextValue | null>(null);

export function useReservations() {
  const ctx = useContext(ReservationsContext);
  if (!ctx) throw new Error("useReservations requires provider");
  return ctx;
}

export function ReservationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurant, restaurantId } = useRestaurant();
  const { canAccessBranch } = useTenant();
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [slotStart, setSlotStart] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16); // will fix with local
  });
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [autoAssign, setAutoAssign] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Fix initial slot to local datetime-local format
  useEffect(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(Math.max(12, d.getHours() + 1));
    const pad = (n: number) => String(n).padStart(2, "0");
    setSlotStart(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
  }, []);

  const branches = useMemo(
    () => allBranches.filter((b) => canAccessBranch(b.id)),
    [allBranches, canAccessBranch],
  );

  const setBranchId = useCallback(
    (id: string) => {
      if (!canAccessBranch(id)) return;
      setBranchIdState(id);
      setBranchPref("reservations", user?.uid, restaurantId, id);
    },
    [canAccessBranch, user?.uid, restaurantId],
  );

  useEffect(() => {
    setBranchIdState(null);
    setReservations([]);
    setWaitlist([]);
    setTables([]);
  }, [user?.uid]);

  useEffect(() => {
    if (!restaurantId || !isFirebaseConfigured()) {
      setReady(true);
      setError(
        !isFirebaseConfigured()
          ? "Firebase no está configurado"
          : "Selecciona un restaurante",
      );
      return;
    }
    setError(null);
    return onSnapshot(
      collection(getDb(), "restaurants", restaurantId, "branches"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Branch)
          .filter((b) => !b.deletedAt);
        setAllBranches(list);
        const allowed = list.filter((b) => canAccessBranch(b.id));
        setBranchIdState((current) => {
          const stored = getBranchPref("reservations", user?.uid, restaurantId);
          const next = pickAllowedBranchId({
            allowedIds: allowed.map((b) => b.id),
            current,
            stored,
            defaultBranchId: restaurant?.settings.defaultBranchId,
            isDefaultId: list.find((b) => b.isDefault)?.id ?? null,
          });
          if (next && user?.uid) {
            setBranchPref("reservations", user.uid, restaurantId, next);
          }
          return next;
        });
        setReady(true);
      },
      (err) => setError(err.message),
    );
  }, [
    restaurantId,
    restaurant?.settings.defaultBranchId,
    user?.uid,
    canAccessBranch,
  ]);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    const unsubs = [
      subscribeReservationTables(restaurantId, branchId, setTables, (e) =>
        setError(e.message),
      ),
      subscribeReservations(restaurantId, branchId, setReservations, (e) =>
        setError(e.message),
      ),
      subscribeWaitlist(restaurantId, branchId, setWaitlist, (e) =>
        setError(e.message),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [restaurantId, branchId]);

  const dayReservations = useMemo(() => {
    const from = startOfDay(selectedDate).getTime();
    const to = endOfDay(selectedDate).getTime();
    return reservations.filter((r) => {
      const t = new Date(r.startsAt).getTime();
      return t >= from && t <= to && r.status !== "cancelled";
    });
  }, [reservations, selectedDate]);

  const dueReminders = useMemo(
    () => reservationsDueForReminder(reservations),
    [reservations],
  );

  // Auto-process reminders while module is open
  useEffect(() => {
    if (!restaurantId || !dueReminders.length) return;
    const t = window.setTimeout(() => {
      void (async () => {
        for (const r of dueReminders.slice(0, 5)) {
          try {
            await markReminderSent({ restaurantId, reservation: r });
          } catch {
            /* ignore */
          }
        }
      })();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [restaurantId, dueReminders]);

  const requireCtx = useCallback(() => {
    if (!restaurantId || !branchId || !user) {
      throw new Error("Contexto de reservas incompleto");
    }
    return { restaurantId, branchId, uid: user.uid };
  }, [restaurantId, branchId, user]);

  const value: ReservationsContextValue = {
    ready,
    error,
    branches,
    branchId,
    setBranchId,
    tables,
    reservations,
    waitlist,
    selectedDate,
    setSelectedDate: (d) => setSelectedDate(startOfDay(d)),
    dayReservations,
    slotStart,
    setSlotStart,
    durationMinutes,
    setDurationMinutes,
    autoAssign,
    setAutoAssign,
    restaurantName: restaurant?.name ?? "SmartServe",
    createBooking: async (input) => {
      const { restaurantId: rid, branchId: bid, uid } = requireCtx();
      return createReservation({
        restaurantId: rid,
        branchId: bid,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        partySize: input.partySize,
        startsAt: fromLocalInputValue(slotStart),
        durationMinutes,
        tableId: input.tableId,
        notes: input.notes,
        autoAssign,
        tables,
        existing: reservations,
        createdBy: uid,
      });
    },
    setStatus: async (r, status) => {
      const { restaurantId: rid } = requireCtx();
      await updateReservationStatus({
        restaurantId: rid,
        reservation: r,
        status,
      });
    },
    confirmReservation: async (r) => {
      const { restaurantId: rid } = requireCtx();
      await markConfirmationSent({ restaurantId: rid, reservation: r });
    },
    sendReminder: async (r) => {
      const { restaurantId: rid } = requireCtx();
      await markReminderSent({ restaurantId: rid, reservation: r });
    },
    runAutoAssign: async (r) => {
      const { restaurantId: rid } = requireCtx();
      await autoAssignReservation({
        restaurantId: rid,
        reservation: r,
        tables,
        existing: reservations,
      });
    },
    addToWaitlist: async (input) => {
      const { restaurantId: rid, branchId: bid, uid } = requireCtx();
      await addWaitlistEntry({
        restaurantId: rid,
        branchId: bid,
        ...input,
        preferredStartsAt: fromLocalInputValue(slotStart),
        createdBy: uid,
      });
    },
    bookFromWaitlist: async (entry) => {
      const { restaurantId: rid, branchId: bid, uid } = requireCtx();
      await seatFromWaitlist({
        restaurantId: rid,
        branchId: bid,
        entry,
        startsAt: fromLocalInputValue(slotStart),
        durationMinutes,
        tables,
        existing: reservations,
        createdBy: uid,
        autoAssign: true,
      });
    },
    removeWaitlist: async (id) => {
      const { restaurantId: rid } = requireCtx();
      await cancelWaitlistEntry({ restaurantId: rid, entryId: id });
    },
    dueReminders,
    processDueReminders: async () => {
      const { restaurantId: rid } = requireCtx();
      let n = 0;
      for (const r of reservationsDueForReminder(reservations)) {
        await markReminderSent({ restaurantId: rid, reservation: r });
        n += 1;
      }
      return n;
    },
  };

  return (
    <ReservationsContext.Provider value={value}>
      {children}
    </ReservationsContext.Provider>
  );
}

// re-export helper for forms
export { addMinutes };
