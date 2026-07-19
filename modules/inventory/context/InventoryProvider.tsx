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
import { ensureInventoryBootstrap } from "@/modules/inventory/services/bootstrap.service";
import {
  archiveProduct,
  subscribeCategories,
  subscribeIngredients,
  subscribeProducts,
  saveProductRecipe,
  upsertCategory,
  upsertIngredient,
  upsertProductBasic,
} from "@/modules/inventory/services/catalog-inventory.service";
import {
  computePredictions,
  lowStockAlerts,
  persistPredictions,
  subscribePredictions,
} from "@/modules/inventory/services/forecast.service";
import {
  createPurchase,
  receivePurchase,
  subscribePurchases,
} from "@/modules/inventory/services/purchases.service";
import {
  subscribeLevels,
  subscribeMovements,
  setMinStock,
} from "@/modules/inventory/services/stock.service";
import {
  subscribeSuppliers,
  upsertSupplier,
} from "@/modules/inventory/services/suppliers.service";
import {
  createTransfer,
  receiveTransfer,
  subscribeTransfers,
} from "@/modules/inventory/services/transfers.service";
import {
  recordWaste,
  subscribeWaste,
} from "@/modules/inventory/services/waste.service";
import type {
  Ingredient,
  IngredientUnit,
  Product,
  ProductCategory,
  RecipeIngredient,
} from "@/types/catalog";
import type { CurrencyCode } from "@/types/common";
import type {
  InventoryLevel,
  InventoryMovement,
  InventoryPrediction,
  Purchase,
  PurchaseItem,
  StockTransfer,
  Supplier,
  TransferItem,
  WasteEntry,
  WasteReason,
} from "@/types/inventory";
import type { Branch } from "@/types/restaurant";
import { getDb } from "@/lib/firebase";
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

interface InventoryContextValue {
  ready: boolean;
  error: string | null;
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string) => void;
  currency: CurrencyCode;
  taxPercent: number;
  ingredients: Ingredient[];
  products: Product[];
  categories: ProductCategory[];
  levels: InventoryLevel[];
  movements: InventoryMovement[];
  suppliers: Supplier[];
  purchases: Purchase[];
  waste: WasteEntry[];
  transfers: StockTransfer[];
  predictions: InventoryPrediction[];
  alerts: ReturnType<typeof lowStockAlerts>;
  bootstrap: () => Promise<{ ingredientsCreated: number }>;
  saveIngredient: (input: {
    ingredient?: Ingredient | null;
    name: string;
    unit: IngredientUnit;
    costPerUnit: number;
    sku?: string;
  }) => Promise<void>;
  saveProduct: (input: {
    product?: Product | null;
    name: string;
    categoryId: string;
    price: number;
    brand?: string;
    wholesalePrice?: number;
    stockQty?: number;
    kitchenStation?: Product["kitchenStation"];
    recipe?: RecipeIngredient[];
  }) => Promise<void>;
  saveCategory: (input: {
    category?: ProductCategory | null;
    name: string;
  }) => Promise<void>;
  /** Solo roles con gestión plena de catálogo (no cocina). */
  removeProduct: (productId: string) => Promise<void>;
  saveRecipe: (product: Product, recipe: RecipeIngredient[]) => Promise<void>;
  updateMinStock: (ingredientId: string, minStock: number) => Promise<void>;
  saveSupplier: (input: {
    supplier?: Supplier | null;
    name: string;
    email?: string;
    phone?: string;
  }) => Promise<void>;
  addPurchase: (input: {
    supplierId: string;
    items: PurchaseItem[];
    notes?: string;
  }) => Promise<void>;
  markPurchaseReceived: (purchase: Purchase) => Promise<void>;
  addWaste: (input: {
    ingredientId: string;
    quantity: number;
    reason: WasteReason;
    note?: string;
  }) => Promise<void>;
  addTransfer: (input: {
    toBranchId: string;
    items: TransferItem[];
    notes?: string;
  }) => Promise<void>;
  markTransferReceived: (transfer: StockTransfer) => Promise<void>;
  runAiForecast: () => Promise<number>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory requires InventoryProvider");
  return ctx;
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { restaurant, restaurantId } = useRestaurant();
  const { canAccessBranch } = useTenant();
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [levels, setLevels] = useState<InventoryLevel[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [waste, setWaste] = useState<WasteEntry[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [predictions, setPredictions] = useState<InventoryPrediction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const currency = (restaurant?.currency ?? "EUR") as CurrencyCode;
  const taxPercent = restaurant?.settings.taxPercent ?? 10;

  const branches = useMemo(
    () => allBranches.filter((b) => canAccessBranch(b.id)),
    [allBranches, canAccessBranch],
  );

  const setBranchId = useCallback(
    (id: string) => {
      if (!canAccessBranch(id)) return;
      setBranchIdState(id);
      setBranchPref("inventory", user?.uid, restaurantId, id);
    },
    [canAccessBranch, user?.uid, restaurantId],
  );

  useEffect(() => {
    setBranchIdState(null);
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
          const stored = getBranchPref("inventory", user?.uid, restaurantId);
          const next = pickAllowedBranchId({
            allowedIds: allowed.map((b) => b.id),
            current,
            stored,
            defaultBranchId: restaurant?.settings.defaultBranchId,
            isDefaultId: list.find((b) => b.isDefault)?.id ?? null,
          });
          if (next && user?.uid) {
            setBranchPref("inventory", user.uid, restaurantId, next);
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
    if (!restaurantId) return;
    const unsubs = [
      subscribeIngredients(restaurantId, setIngredients, (e) =>
        setError(e.message),
      ),
      subscribeProducts(restaurantId, setProducts, (e) => setError(e.message)),
      subscribeCategories(restaurantId, setCategories, (e) =>
        setError(e.message),
      ),
      subscribeSuppliers(restaurantId, setSuppliers, (e) =>
        setError(e.message),
      ),
      subscribeTransfers(restaurantId, setTransfers, (e) =>
        setError(e.message),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !branchId) return;
    const unsubs = [
      subscribeLevels(restaurantId, branchId, setLevels, (e) =>
        setError(e.message),
      ),
      subscribeMovements(restaurantId, branchId, setMovements, (e) =>
        setError(e.message),
      ),
      subscribePurchases(restaurantId, branchId, setPurchases, (e) =>
        setError(e.message),
      ),
      subscribeWaste(restaurantId, branchId, setWaste, (e) =>
        setError(e.message),
      ),
      subscribePredictions(restaurantId, branchId, setPredictions, (e) =>
        setError(e.message),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [restaurantId, branchId]);

  const alerts = useMemo(
    () => lowStockAlerts(levels, ingredients),
    [levels, ingredients],
  );

  const requireCtx = useCallback(() => {
    if (!restaurantId || !branchId || !user) {
      throw new Error("Contexto de inventario incompleto");
    }
    return { restaurantId, branchId, uid: user.uid };
  }, [restaurantId, branchId, user]);

  const value: InventoryContextValue = {
    ready,
    error,
    branches,
    branchId,
    setBranchId,
    currency,
    taxPercent,
    ingredients,
    products,
    categories,
    levels,
    movements,
    suppliers,
    purchases,
    waste,
    transfers,
    predictions,
    alerts,
    bootstrap: async () => {
      const { restaurantId: rid, branchId: bid } = requireCtx();
      return ensureInventoryBootstrap({
        restaurantId: rid,
        branchId: bid,
        currency,
      });
    },
    saveIngredient: async (input) => {
      const { restaurantId: rid } = requireCtx();
      await upsertIngredient({
        restaurantId: rid,
        ingredient: input.ingredient,
        name: input.name,
        unit: input.unit,
        costPerUnit: input.costPerUnit,
        currency,
        sku: input.sku,
      });
    },
    saveProduct: async (input) => {
      const { restaurantId: rid } = requireCtx();
      await upsertProductBasic({
        restaurantId: rid,
        product: input.product,
        name: input.name,
        categoryId: input.categoryId,
        price: input.price,
        brand: input.brand,
        wholesalePrice: input.wholesalePrice,
        stockQty: input.stockQty,
        kitchenStation: input.kitchenStation,
        currency,
        recipe: input.recipe,
      });
    },
    saveCategory: async (input) => {
      const { restaurantId: rid } = requireCtx();
      await upsertCategory({
        restaurantId: rid,
        category: input.category,
        name: input.name,
      });
    },
    removeProduct: async (productId) => {
      const { restaurantId: rid } = requireCtx();
      await archiveProduct({ restaurantId: rid, productId });
    },
    saveRecipe: async (product, recipe) => {
      const { restaurantId: rid } = requireCtx();
      await saveProductRecipe({ restaurantId: rid, product, recipe });
    },
    updateMinStock: async (ingredientId, minStock) => {
      const { restaurantId: rid, branchId: bid, uid } = requireCtx();
      const ing = ingredients.find((i) => i.id === ingredientId);
      if (!ing) throw new Error("Ingrediente no encontrado");
      await setMinStock({
        restaurantId: rid,
        branchId: bid,
        ingredientId,
        unit: ing.unit,
        minStock,
        createdBy: uid,
      });
    },
    saveSupplier: async (input) => {
      const { restaurantId: rid } = requireCtx();
      await upsertSupplier({ restaurantId: rid, ...input });
    },
    addPurchase: async (input) => {
      const { restaurantId: rid, branchId: bid, uid } = requireCtx();
      await createPurchase({
        restaurantId: rid,
        branchId: bid,
        supplierId: input.supplierId,
        items: input.items,
        currency,
        taxPercent,
        createdBy: uid,
        notes: input.notes,
      });
    },
    markPurchaseReceived: async (purchase) => {
      const { restaurantId: rid, uid } = requireCtx();
      await receivePurchase({
        restaurantId: rid,
        purchase,
        actorUid: uid,
      });
    },
    addWaste: async (input) => {
      const { restaurantId: rid, branchId: bid, uid } = requireCtx();
      const ing = ingredients.find((i) => i.id === input.ingredientId);
      if (!ing) throw new Error("Ingrediente no encontrado");
      await recordWaste({
        restaurantId: rid,
        branchId: bid,
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.unit,
        quantity: input.quantity,
        reason: input.reason,
        costPerUnit: ing.costPerUnit,
        createdBy: uid,
        note: input.note,
      });
    },
    addTransfer: async (input) => {
      const { restaurantId: rid, branchId: bid, uid } = requireCtx();
      await createTransfer({
        restaurantId: rid,
        fromBranchId: bid,
        toBranchId: input.toBranchId,
        items: input.items,
        createdBy: uid,
        notes: input.notes,
      });
    },
    markTransferReceived: async (transfer) => {
      const { restaurantId: rid, uid } = requireCtx();
      await receiveTransfer({
        restaurantId: rid,
        transfer,
        actorUid: uid,
      });
    },
    runAiForecast: async () => {
      const { restaurantId: rid, branchId: bid } = requireCtx();
      const predictions = computePredictions({
        restaurantId: rid,
        branchId: bid,
        levels,
        movements,
        ingredients,
      });
      await persistPredictions({
        restaurantId: rid,
        branchId: bid,
        predictions,
        writeInsights: true,
      });
      return predictions.length;
    },
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}
