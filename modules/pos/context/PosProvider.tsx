"use client";

import { useAuth } from "@/context/AuthProvider";
import { useRestaurant } from "@/context/RestaurantProvider";
import { useTenant } from "@/context/TenantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  getBranchPref,
  pickAllowedBranchId,
  setBranchPref,
} from "@/lib/session-prefs";
import { resolveItemStation } from "@/modules/kitchen/domain/stations";
import { advanceTicketColumn } from "@/modules/kitchen/services/kitchen.service";
import { getEffectivePrintSettings } from "@/lib/printer-device-prefs";
import { printOrderReceipt } from "@/modules/pos/domain/print";
import { balanceDue } from "@/modules/pos/domain/totals";
import {
  enqueueMutation,
  listQueuedMutations,
} from "@/modules/pos/offline/queue";
import {
  flushOfflineQueue,
  registerOfflineFlushHandler,
  setFirestoreConnectivity,
  type SyncStatus,
} from "@/modules/pos/offline/sync";
import { ensurePosBootstrap } from "@/modules/pos/services/bootstrap.service";
import { subscribeBranches } from "@/modules/pos/services/branches.service";
import {
  subscribeCategories,
  subscribeProducts,
} from "@/modules/pos/services/catalog.service";
import {
  addItemToOrder,
  mergeTables,
  moveOrderToTable,
  newId,
  openTable,
  removeOrderItem,
  saveOrder,
  sendToKitchen,
  subscribeOpenOrders,
  subscribeOrder,
  subscribeRecentPaidOrders,
  updateOrderItem,
  markPrinted,
} from "@/modules/pos/services/orders.service";
import { applyPaidOrderToCrm } from "@/modules/customers/services/orders-crm.service";
import { deductOrderFromInventory } from "@/modules/inventory/services/sale-deduction.service";
import {
  chargeOrder,
  refundPayment,
  subscribePaymentsForOrder,
} from "@/modules/pos/services/payments.service";
import {
  createTable,
  deleteTable,
  markTableClean as markTableCleanService,
  subscribeTables,
  updateTable,
} from "@/modules/pos/services/tables.service";
import type { Product, ProductCategory } from "@/types/catalog";
import type {
  Order,
  OrderItem,
  OrderItemModifier,
  Payment,
  PaymentMethod,
  Table,
} from "@/types/orders";
import type { Branch } from "@/types/restaurant";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";


interface PosContextValue {
  ready: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  queueSize: number;
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string) => void;
  tables: Table[];
  categories: ProductCategory[];
  products: Product[];
  openOrders: Order[];
  historyOrders: Order[];
  selectedTableId: string | null;
  selectTable: (tableId: string | null) => void;
  activeOrder: Order | null;
  payments: Payment[];
  taxPercent: number;
  tipDefault: number;
  currency: string;
  restaurantName: string;
  bootstrap: () => Promise<{ tablesCreated: number; productsCreated: number }>;
  createFloorTable: (input: {
    name: string;
    seats: number;
    zone?: "sala" | "barra" | "terraza";
  }) => Promise<Table>;
  updateFloorTable: (input: {
    tableId: string;
    name?: string;
    seats?: number;
    zone?: string;
  }) => Promise<void>;
  removeFloorTable: (tableId: string) => Promise<void>;
  /** Mesa sucia o ocupada fantasma → libre. */
  markTableClean: (tableId: string) => Promise<void>;
  openSelectedTable: () => Promise<void>;
  addProduct: (input: {
    product: Product;
    variantId?: string;
    modifiers?: OrderItemModifier[];
    kitchenNotes?: string;
    quantity?: number;
  }) => Promise<void>;
  setItemQty: (itemId: string, quantity: number) => Promise<void>;
  setItemNotes: (itemId: string, kitchenNotes: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  setDiscount: (percent: number, amount?: number) => Promise<void>;
  setTip: (percent: number, amount?: number) => Promise<void>;
  /** Envía a cocina/barra (el ticket térmico sale en /kitchen|/bar, no en el mesero). */
  sendKitchen: () => Promise<{ printed: boolean }>;
  /** Mesero: lleva a mesa → marca ítems listos como servidos. */
  markItemsServed: (itemIds: string[]) => Promise<void>;
  moveToTable: (targetTableId: string) => Promise<void>;
  mergeWithTables: (tableIds: string[]) => Promise<void>;
  applySplit: (parts: number) => Promise<void>;
  assignItemSeat: (itemId: string, seat: number) => Promise<void>;
  pay: (
    method: PaymentMethod,
    amount: number,
    tipAmount?: number,
    splitSeat?: number,
    amountTendered?: number,
    meta?: { chargedFrom?: "waiter" | "caja" | "pos" },
  ) => Promise<void>;
  printReceipt: () => Promise<void>;
  /** Reimpresión desde archivo (pedido ya cobrado). */
  printPaidOrder: (order: Order, orderPayments: Payment[]) => Promise<void>;
  refund: (paymentId: string, amount: number) => Promise<void>;
  clearSelection: () => void;
  balance: number;
}

const PosContext = createContext<PosContextValue | null>(null);

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used within PosProvider");
  return ctx;
}

export function PosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurant, restaurantId } = useRestaurant();
  const { canAccessBranch } = useTenant();
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("online");
  const [queueSize, setQueueSize] = useState(0);
  const [ready, setReady] = useState(false);

  const taxPercent = restaurant?.settings.taxPercent ?? 10;
  const tipDefault = restaurant?.settings.tipDefaultPercent ?? 10;
  const currency = restaurant?.currency ?? "EUR";
  const restaurantName = restaurant?.name ?? "SmartServe";

  const refreshQueueSize = useCallback(() => {
    setQueueSize(listQueuedMutations().length);
  }, []);

  const branches = useMemo(
    () => allBranches.filter((b) => canAccessBranch(b.id)),
    [allBranches, canAccessBranch],
  );

  const setBranchId = useCallback(
    (id: string) => {
      if (!canAccessBranch(id)) return;
      setBranchIdState(id);
      setBranchPref("pos", user?.uid, restaurantId, id);
      setSelectedTableId(null);
    },
    [canAccessBranch, user?.uid, restaurantId],
  );

  // Cambio de usuario: vaciar estado de sala (no mezclar sesiones)
  useEffect(() => {
    setBranchIdState(null);
    setSelectedTableId(null);
    setTables([]);
    setOpenOrders([]);
    setHistoryOrders([]);
    setActiveOrder(null);
    setPayments([]);
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
    return subscribeBranches(restaurantId, (list) => {
      setAllBranches(list);
      const allowed = list.filter((b) => canAccessBranch(b.id));
      setBranchIdState((current) => {
        const stored = getBranchPref("pos", user?.uid, restaurantId);
        const next = pickAllowedBranchId({
          allowedIds: allowed.map((b) => b.id),
          current,
          stored,
          defaultBranchId: restaurant?.settings.defaultBranchId,
          isDefaultId: list.find((b) => b.isDefault)?.id ?? null,
        });
        if (next && user?.uid) {
          setBranchPref("pos", user.uid, restaurantId, next);
        }
        return next;
      });
      setReady(true);
    }, (err) => setError(err.message));
  }, [
    restaurantId,
    restaurant?.settings.defaultBranchId,
    user?.uid,
    canAccessBranch,
  ]);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    const unsubs = [
      subscribeTables(restaurantId, branchId, setTables, (e) =>
        setError(e.message),
      ),
      subscribeCategories(restaurantId, setCategories, (e) =>
        setError(e.message),
      ),
      subscribeProducts(restaurantId, branchId, setProducts, (e) =>
        setError(e.message),
      ),
      subscribeOpenOrders(restaurantId, branchId, setOpenOrders, (e) =>
        setError(e.message),
      ),
      subscribeRecentPaidOrders(restaurantId, branchId, setHistoryOrders, (e) =>
        setError(e.message),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [restaurantId, branchId]);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) ?? null,
    [tables, selectedTableId],
  );

  const orderIdForSelection = useMemo(() => {
    if (!selectedTable) return null;
    if (selectedTable.currentOrderId) return selectedTable.currentOrderId;
    const byTable = openOrders.find((o) => o.tableId === selectedTable.id);
    return byTable?.id ?? null;
  }, [selectedTable, openOrders]);

  useEffect(() => {
    if (!restaurantId || !orderIdForSelection) {
      setActiveOrder(null);
      setPayments([]);
      return;
    }
    const unsubOrder = subscribeOrder(
      restaurantId,
      orderIdForSelection,
      setActiveOrder,
      (e) => setError(e.message),
    );
    const unsubPay = subscribePaymentsForOrder(
      restaurantId,
      orderIdForSelection,
      setPayments,
      (e) => setError(e.message),
    );
    return () => {
      unsubOrder();
      unsubPay();
    };
  }, [restaurantId, orderIdForSelection]);

  useEffect(() => {
    const onOnline = () => {
      setSyncStatus("syncing");
      void setFirestoreConnectivity(true)
        .then(() => flushOfflineQueue())
        .finally(() => {
          setSyncStatus("online");
          refreshQueueSize();
        });
    };
    const onOffline = () => {
      setSyncStatus("offline");
      void setFirestoreConnectivity(false);
    };
    if (typeof window !== "undefined") {
      setSyncStatus(navigator.onLine ? "online" : "offline");
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      refreshQueueSize();
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshQueueSize]);

  useEffect(() => {
    registerOfflineFlushHandler(async () => {
      // Mutations are re-applied by replaying through live services when online;
      // queue entries created while offline store enough context in payload.
      // For v1 we rely on Firestore offline cache for most writes; queue is backup.
    });
  }, []);

  const runOrQueue = useCallback(
    async (type: Parameters<typeof enqueueMutation>[0]["type"], fn: () => Promise<void>, payload: Record<string, unknown>) => {
      if (!restaurantId || !branchId) throw new Error("Sin contexto POS");
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          enqueueMutation({
            type,
            restaurantId,
            branchId,
            payload,
          });
          refreshQueueSize();
          setSyncStatus("offline");
          // Still attempt — Firestore persistence may accept the write.
        }
        await fn();
      } catch (err) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          enqueueMutation({ type, restaurantId, branchId, payload });
          refreshQueueSize();
          return;
        }
        throw err;
      }
    },
    [restaurantId, branchId, refreshQueueSize],
  );

  const bootstrap = useCallback(async () => {
    if (!restaurantId || !branchId) {
      throw new Error("Selecciona restaurante y sucursal");
    }
    return ensurePosBootstrap({
      restaurantId,
      branchId,
      currency: currency as "EUR",
    });
  }, [restaurantId, branchId, currency]);

  const openSelectedTable = useCallback(async () => {
    if (!restaurantId || !branchId || !user || !selectedTable) return;
    await runOrQueue(
      "openTable",
      async () => {
        const order = await openTable({
          restaurantId,
          branchId,
          table: selectedTable,
          uid: user.uid,
          waiterName: user.displayName || user.email || undefined,
          currency: currency as "EUR",
          taxPercent,
          tipDefaultPercent: tipDefault,
        });
        setActiveOrder(order);
      },
      { tableId: selectedTable.id },
    );
  }, [
    restaurantId,
    branchId,
    user,
    selectedTable,
    currency,
    taxPercent,
    tipDefault,
    runOrQueue,
  ]);

  const requireOrder = useCallback(() => {
    if (!activeOrder || !restaurantId || !user) {
      throw new Error("Abre una mesa primero");
    }
    return { order: activeOrder, restaurantId, uid: user.uid };
  }, [activeOrder, restaurantId, user]);

  const addProduct = useCallback(
    async (input: {
      product: Product;
      variantId?: string;
      modifiers?: OrderItemModifier[];
      kitchenNotes?: string;
      quantity?: number;
    }) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      const variant = input.product.variants?.find(
        (v) => v.id === input.variantId,
      );
      const unitPrice =
        variant?.price ??
        input.product.price + (variant?.priceDelta ?? 0);
      const category = categories.find(
        (c) => c.id === input.product.categoryId,
      );
      const kitchenStation = resolveItemStation(
        {
          id: "",
          productId: input.product.id,
          name: input.product.name,
          quantity: 1,
          unitPrice,
          status: "open",
          kitchenStation: input.product.kitchenStation,
        },
        input.product,
        category,
      );
      const item: OrderItem = {
        id: newId("li"),
        productId: input.product.id,
        name: input.product.name,
        quantity: input.quantity ?? 1,
        unitPrice,
        status: "open",
        kitchenStation,
        ...(variant?.id ? { variantId: variant.id } : {}),
        ...(variant?.name ? { variantName: variant.name } : {}),
        ...(input.modifiers?.length ? { modifiers: input.modifiers } : {}),
        ...(input.kitchenNotes?.trim()
          ? { kitchenNotes: input.kitchenNotes.trim() }
          : {}),
      };
      await runOrQueue(
        "updateOrder",
        async () => {
          await addItemToOrder(rid, order, item, taxPercent, uid);
        },
        { orderId: order.id, item },
      );
    },
    [requireOrder, taxPercent, runOrQueue, categories],
  );

  const setItemQty = useCallback(
    async (itemId: string, quantity: number) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      if (quantity <= 0) {
        await removeOrderItem(rid, order, itemId, taxPercent, uid);
        return;
      }
      await updateOrderItem(
        rid,
        order,
        itemId,
        { quantity },
        taxPercent,
        uid,
      );
    },
    [requireOrder, taxPercent],
  );

  const setItemNotes = useCallback(
    async (itemId: string, kitchenNotes: string) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      await updateOrderItem(
        rid,
        order,
        itemId,
        { kitchenNotes },
        taxPercent,
        uid,
      );
    },
    [requireOrder, taxPercent],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      await removeOrderItem(rid, order, itemId, taxPercent, uid);
    },
    [requireOrder, taxPercent],
  );

  const setDiscount = useCallback(
    async (percent: number, amount = 0) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      await saveOrder(
        rid,
        { ...order, discountPercent: percent, discountAmount: amount },
        taxPercent,
        uid,
        "discount.updated",
      );
    },
    [requireOrder, taxPercent],
  );

  const setTip = useCallback(
    async (percent: number, amount = 0) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      await saveOrder(
        rid,
        { ...order, tipPercent: percent, tipAmount: amount },
        taxPercent,
        uid,
        "tip.updated",
      );
    },
    [requireOrder, taxPercent],
  );

  const sendKitchen = useCallback(async () => {
    const { order, restaurantId: rid, uid } = requireOrder();
    await sendToKitchen(
      rid,
      order,
      taxPercent,
      uid,
      products,
      categories,
      user?.displayName || user?.email || undefined,
    );
    // La comanda se imprime en el PC/tablet de cocina o barra (/kitchen|/bar),
    // no en el mesero (así va a la impresora de cocina).
    return { printed: false };
  }, [requireOrder, taxPercent, products, categories, user]);

  const markItemsServed = useCallback(
    async (itemIds: string[]) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      await advanceTicketColumn({
        restaurantId: rid,
        order,
        itemIds,
        toColumn: "delivered",
        actorUid: uid,
      });
    },
    [requireOrder],
  );

  const moveToTable = useCallback(
    async (targetTableId: string) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      const from = tables.find((t) => t.id === order.tableId);
      const to = tables.find((t) => t.id === targetTableId);
      if (!from || !to) throw new Error("Mesa no encontrada");
      await moveOrderToTable(rid, order, from, to, uid);
      setSelectedTableId(to.id);
    },
    [requireOrder, tables],
  );

  const mergeWithTables = useCallback(
    async (tableIds: string[]) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      const primary = tables.find((t) => t.id === order.tableId);
      if (!primary) throw new Error("Mesa principal no encontrada");
      const secondary = tableIds
        .filter((id) => id !== primary.id)
        .map((id) => {
          const table = tables.find((t) => t.id === id);
          if (!table) throw new Error("Mesa no encontrada");
          const secOrder =
            openOrders.find((o) => o.id === table.currentOrderId) ?? null;
          return { table, order: secOrder };
        });
      await mergeTables(rid, order, primary, secondary, taxPercent, uid);
    },
    [requireOrder, tables, openOrders, taxPercent],
  );

  const applySplit = useCallback(
    async (parts: number) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      const seats = Array.from({ length: parts }, (_, i) => ({
        seat: i + 1,
        label: `Parte ${i + 1}`,
        paidAmount: 0,
      }));
      await saveOrder(
        rid,
        { ...order, splitParts: parts, splitSeats: seats },
        taxPercent,
        uid,
        "split.configured",
      );
    },
    [requireOrder, taxPercent],
  );

  const assignItemSeat = useCallback(
    async (itemId: string, seat: number) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      await updateOrderItem(
        rid,
        order,
        itemId,
        { splitSeat: seat },
        taxPercent,
        uid,
      );
    },
    [requireOrder, taxPercent],
  );

  const pay = useCallback(
    async (
      method: PaymentMethod,
      amount: number,
      tipAmount = 0,
      splitSeat?: number,
      amountTendered?: number,
      meta?: { chargedFrom?: "waiter" | "caja" | "pos" },
    ) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      const { order: next } = await chargeOrder({
        restaurantId: rid,
        order,
        tables,
        method,
        amount,
        tipAmount,
        splitSeat,
        amountTendered,
        uid,
        processedByName: user?.displayName || user?.email || undefined,
        chargedFrom: meta?.chargedFrom,
        taxPercent,
      });
      // Side-effects en el cobro (idempotentes): no hace falta sync global en mesero/caja
      if (next.status === "paid" || next.paidAt) {
        void deductOrderFromInventory({
          restaurantId: rid,
          order: next,
          actorUid: uid,
        }).catch(() => undefined);
        void applyPaidOrderToCrm({
          restaurantId: rid,
          order: next,
          actorUid: uid,
        }).catch(() => undefined);
      }
    },
    [requireOrder, tables, taxPercent, user?.displayName, user?.email],
  );

  const printReceipt = useCallback(async () => {
    const { order, restaurantId: rid, uid } = requireOrder();
    const paid =
      order.status === "paid" ||
      Boolean(order.paidAt) ||
      balanceDue(order) <= 0.001;
    if (!paid) {
      throw new Error("El ticket solo se imprime cuando ya está cobrado");
    }
    const tpv = getEffectivePrintSettings(rid, restaurant?.settings).printers
      .tpv;
    printOrderReceipt(order, payments, {
      restaurantName,
      paperWidthMm: tpv?.paperWidthMm ?? 80,
      printerSystemName: tpv?.systemName,
      printerLabel: tpv?.label ?? "Ventas · ticket cliente",
    });
    await markPrinted(rid, order, uid);
  }, [requireOrder, payments, restaurantName, restaurant?.settings]);

  const printPaidOrder = useCallback(
    async (order: Order, orderPayments: Payment[]) => {
      if (!restaurantId || !user) throw new Error("Sin sesión");
      const paid =
        order.status === "paid" ||
        Boolean(order.paidAt) ||
        balanceDue(order) <= 0.001;
      if (!paid) {
        throw new Error("El ticket solo se imprime cuando ya está cobrado");
      }
      const tpv = getEffectivePrintSettings(
        restaurantId,
        restaurant?.settings,
      ).printers.tpv;
      printOrderReceipt(order, orderPayments, {
        restaurantName,
        paperWidthMm: tpv?.paperWidthMm ?? 80,
        printerSystemName: tpv?.systemName,
        printerLabel: tpv?.label ?? "Ventas · ticket cliente",
      });
      await markPrinted(restaurantId, order, user.uid);
    },
    [restaurantId, user, restaurantName, restaurant?.settings],
  );

  const refund = useCallback(
    async (paymentId: string, amount: number) => {
      const { order, restaurantId: rid, uid } = requireOrder();
      const payment = payments.find((p) => p.id === paymentId);
      if (!payment) throw new Error("Pago no encontrado");
      const table = tables.find((t) => t.id === order.tableId) ?? null;
      await refundPayment({
        restaurantId: rid,
        order,
        payment,
        amount,
        uid,
        taxPercent,
        reopenTable: table,
      });
    },
    [requireOrder, payments, tables, taxPercent],
  );

  const createFloorTable = useCallback(
    async (input: {
      name: string;
      seats: number;
      zone?: "sala" | "barra" | "terraza";
    }) => {
      if (!restaurantId || !branchId) throw new Error("Sin sucursal");
      return createTable({
        restaurantId,
        branchId,
        name: input.name,
        seats: input.seats,
        zone: input.zone,
        existingCount: tables.length,
      });
    },
    [restaurantId, branchId, tables.length],
  );

  const updateFloorTable = useCallback(
    async (input: {
      tableId: string;
      name?: string;
      seats?: number;
      zone?: string;
    }) => {
      if (!restaurantId) throw new Error("Sin restaurante");
      await updateTable({
        restaurantId,
        tableId: input.tableId,
        name: input.name,
        seats: input.seats,
        zone: input.zone,
      });
    },
    [restaurantId],
  );

  const removeFloorTable = useCallback(
    async (tableId: string) => {
      if (!restaurantId) throw new Error("Sin restaurante");
      const table = tables.find((t) => t.id === tableId);
      if (!table) throw new Error("Mesa no encontrada");
      await deleteTable({ restaurantId, table });
      if (selectedTableId === tableId) setSelectedTableId(null);
    },
    [restaurantId, tables, selectedTableId],
  );

  const markTableClean = useCallback(
    async (tableId: string) => {
      if (!restaurantId) throw new Error("Sin restaurante");
      await markTableCleanService({ restaurantId, tableId });
    },
    [restaurantId],
  );

  const value: PosContextValue = {
    ready,
    error,
    syncStatus,
    queueSize,
    branches,
    branchId,
    setBranchId,
    tables,
    categories,
    products,
    openOrders,
    historyOrders,
    selectedTableId,
    selectTable: setSelectedTableId,
    activeOrder,
    payments,
    taxPercent,
    tipDefault,
    currency,
    restaurantName,
    bootstrap,
    createFloorTable,
    updateFloorTable,
    removeFloorTable,
    markTableClean,
    openSelectedTable,
    addProduct,
    setItemQty,
    setItemNotes,
    removeItem,
    setDiscount,
    setTip,
    sendKitchen,
    markItemsServed,
    moveToTable,
    mergeWithTables,
    applySplit,
    assignItemSeat,
    pay,
    printReceipt,
    printPaidOrder,
    refund,
    clearSelection: () => setSelectedTableId(null),
    balance: activeOrder ? balanceDue(activeOrder) : 0,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
