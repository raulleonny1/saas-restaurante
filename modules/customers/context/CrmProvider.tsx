"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import { ensureCrmBootstrap } from "@/modules/customers/services/bootstrap.service";
import {
  enrichCustomer,
  recomputeCustomerMetrics,
  softDeleteCustomer,
  subscribeCustomers,
  upsertCustomer,
} from "@/modules/customers/services/customers.service";
import { appendHistory, subscribeCustomerHistory } from "@/modules/customers/services/history.service";
import {
  adjustPoints,
  subscribeLoyaltyAccount,
  subscribeLoyaltyTx,
} from "@/modules/customers/services/loyalty.service";
import { subscribeCustomerOrders } from "@/modules/customers/services/orders-crm.service";
import {
  createPersonalizedPromo,
  subscribePersonalizedPromos,
} from "@/modules/customers/services/promos-crm.service";
import type {
  Customer,
  CustomerHistoryEntry,
  CustomerPreferences,
  CustomerSegmentId,
  LoyaltyAccount,
  LoyaltyTransaction,
  PersonalizedPromoDraft,
} from "@/types/customers";
import type { Order } from "@/types/orders";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface CrmContextValue {
  ready: boolean;
  error: string | null;
  customers: Customer[];
  filtered: Customer[];
  query: string;
  setQuery: (q: string) => void;
  segmentFilter: CustomerSegmentId | "all";
  setSegmentFilter: (s: CustomerSegmentId | "all") => void;
  selectedId: string | null;
  selectCustomer: (id: string | null) => void;
  selected: Customer | null;
  history: CustomerHistoryEntry[];
  orders: Order[];
  loyalty: LoyaltyAccount | null;
  loyaltyTx: LoyaltyTransaction[];
  promos: PersonalizedPromoDraft[];
  bootstrap: () => Promise<{ created: number }>;
  saveCustomer: (input: {
    customer?: Customer | null;
    name: string;
    email?: string;
    phone?: string;
    birthday?: string;
    allergies?: string[];
    preferences?: CustomerPreferences;
    favorites?: string[];
    tags?: string[];
    notes?: string;
    marketingOptIn?: boolean;
  }) => Promise<Customer>;
  removeCustomer: (id: string) => Promise<void>;
  addNote: (text: string) => Promise<void>;
  adjustCustomerPoints: (
    points: number,
    type: "earn" | "redeem" | "adjust",
    note?: string,
  ) => Promise<void>;
  offerPersonalizedPromo: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
}

const CrmContext = createContext<CrmContextValue | null>(null);

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm requires CrmProvider");
  return ctx;
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurantId } = useRestaurant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<CustomerHistoryEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [loyaltyTx, setLoyaltyTx] = useState<LoyaltyTransaction[]>([]);
  const [promos, setPromos] = useState<PersonalizedPromoDraft[]>([]);
  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<CustomerSegmentId | "all">(
    "all",
  );
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
    return subscribeCustomers(
      restaurantId,
      (rows) => {
        setCustomers(rows.map(enrichCustomer));
        setReady(true);
      },
      (e) => setError(e.message),
    );
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !selectedId) {
      setHistory([]);
      setOrders([]);
      setLoyalty(null);
      setLoyaltyTx([]);
      setPromos([]);
      return;
    }
    const unsubs = [
      subscribeCustomerHistory(restaurantId, selectedId, setHistory, (e) =>
        setError(e.message),
      ),
      subscribeCustomerOrders(restaurantId, selectedId, setOrders, (e) =>
        setError(e.message),
      ),
      subscribeLoyaltyAccount(restaurantId, selectedId, setLoyalty, (e) =>
        setError(e.message),
      ),
      subscribeLoyaltyTx(restaurantId, selectedId, setLoyaltyTx, (e) =>
        setError(e.message),
      ),
      subscribePersonalizedPromos(restaurantId, selectedId, setPromos, (e) =>
        setError(e.message),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [restaurantId, selectedId]);

  const filtered = useMemo(() => {
    let list = customers;
    if (segmentFilter !== "all") {
      list = list.filter((c) => c.segments?.includes(segmentFilter));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list.sort((a, b) => (b.valueScore ?? 0) - (a.valueScore ?? 0));
  }, [customers, query, segmentFilter]);

  const selected = useMemo(
    () => customers.find((c) => c.id === selectedId) ?? null,
    [customers, selectedId],
  );

  const requireCtx = useCallback(() => {
    if (!restaurantId || !user) throw new Error("Sin sesión CRM");
    return { restaurantId, uid: user.uid };
  }, [restaurantId, user]);

  const value: CrmContextValue = {
    ready,
    error,
    customers,
    filtered,
    query,
    setQuery,
    segmentFilter,
    setSegmentFilter,
    selectedId,
    selectCustomer: setSelectedId,
    selected,
    history,
    orders,
    loyalty,
    loyaltyTx,
    promos,
    bootstrap: async () => {
      const { restaurantId: rid } = requireCtx();
      return ensureCrmBootstrap(rid);
    },
    saveCustomer: async (input) => {
      const { restaurantId: rid } = requireCtx();
      return upsertCustomer({ restaurantId: rid, ...input });
    },
    removeCustomer: async (id) => {
      const { restaurantId: rid } = requireCtx();
      await softDeleteCustomer(rid, id);
      if (selectedId === id) setSelectedId(null);
    },
    addNote: async (text) => {
      const { restaurantId: rid, uid } = requireCtx();
      if (!selectedId) throw new Error("Selecciona un cliente");
      await appendHistory({
        restaurantId: rid,
        customerId: selectedId,
        type: "note",
        title: "Nota",
        description: text,
        actorUid: uid,
      });
    },
    adjustCustomerPoints: async (points, type, note) => {
      const { restaurantId: rid, uid } = requireCtx();
      if (!selectedId) throw new Error("Selecciona un cliente");
      await adjustPoints({
        restaurantId: rid,
        customerId: selectedId,
        points,
        type,
        createdBy: uid,
        note,
      });
    },
    offerPersonalizedPromo: async () => {
      const { restaurantId: rid, uid } = requireCtx();
      if (!selected) throw new Error("Selecciona un cliente");
      await createPersonalizedPromo({
        restaurantId: rid,
        customer: selected,
        createdBy: uid,
      });
    },
    refreshMetrics: async () => {
      const { restaurantId: rid } = requireCtx();
      if (!selected) return;
      await recomputeCustomerMetrics(rid, selected);
    },
  };

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}
