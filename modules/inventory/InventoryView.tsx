"use client";

import { useAuth } from "@/context/AuthProvider";
import {
  AiForecastPanel,
  AlertsPanel,
  IngredientsPanel,
  MovementsPanel,
  ProductsRecipesPanel,
  PurchasesPanel,
  SuppliersPanel,
  TransfersPanel,
  WastePanel,
} from "@/modules/inventory/components/InventoryPanels";
import {
  InventoryProvider,
  useInventory,
} from "@/modules/inventory/context/InventoryProvider";
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@/ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function InventoryWorkspace() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const {
    ready,
    error,
    branches,
    branchId,
    setBranchId,
    alerts,
    ingredients,
    bootstrap,
  } = useInventory();

  const canInventory = can("inventory.read") || can("inventory.adjust");
  const canCatalog =
    can("catalog.products.manage") ||
    can("catalog.categories.manage") ||
    can("catalog.read");

  const tabFromUrl = searchParams.get("tab");
  const defaultTab =
    tabFromUrl === "products" || (!canInventory && canCatalog)
      ? "products"
      : "alerts";
  const [tab, setTab] = useState(defaultTab);
  const [booting, setBooting] = useState(false);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!canInventory && !canCatalog) {
    return (
      <Alert tone="warning" title="Sin acceso">
        Necesitas permiso de inventario o de catálogo.
      </Alert>
    );
  }

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <PageHeader
        title="Inventario y carta"
        description="Crea categorías y productos (marca, cantidad, precio unitario y por mayor). Recetas y stock de ingredientes."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {canInventory ? (
              alerts.length ? (
                <Badge tone="danger">{alerts.length} alertas</Badge>
              ) : (
                <Badge tone="success">Stock OK</Badge>
              )
            ) : null}
            {branchId && branches.length > 0 ? (
              <Select
                aria-label="Sucursal"
                className="min-w-[160px]"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {canInventory && !ingredients.length ? (
              <Button
                size="sm"
                disabled={booting}
                onClick={() => {
                  void (async () => {
                    try {
                      setBooting(true);
                      const res = await bootstrap();
                      toast(
                        `Inventario listo: ${res.ingredientsCreated} ingredientes`,
                        "success",
                      );
                    } catch (e) {
                      toast(
                        e instanceof Error ? e.message : "Error",
                        "error",
                      );
                    } finally {
                      setBooting(false);
                    }
                  })();
                }}
              >
                Inicializar stock
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Alert tone="danger" title="Error Firestore">
          {error}
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {canInventory ? (
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          ) : null}
          {canInventory ? (
            <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
          ) : null}
          <TabsTrigger value="products">Carta / Productos</TabsTrigger>
          {canInventory ? (
            <>
              <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
              <TabsTrigger value="purchases">Compras</TabsTrigger>
              <TabsTrigger value="waste">Merma</TabsTrigger>
              <TabsTrigger value="transfers">Transferencias</TabsTrigger>
              <TabsTrigger value="movements">Movimientos</TabsTrigger>
              <TabsTrigger value="ai">Predicción IA</TabsTrigger>
            </>
          ) : null}
        </TabsList>

        {canInventory ? (
          <TabsContent value="alerts">
            <AlertsPanel />
          </TabsContent>
        ) : null}
        {canInventory ? (
          <TabsContent value="ingredients">
            <IngredientsPanel />
          </TabsContent>
        ) : null}
        <TabsContent value="products">
          <ProductsRecipesPanel
            mode={
              can("catalog.categories.manage") ? "full" : "kitchen"
            }
          />
        </TabsContent>
        {canInventory ? (
          <>
            <TabsContent value="suppliers">
              <SuppliersPanel />
            </TabsContent>
            <TabsContent value="purchases">
              <PurchasesPanel />
            </TabsContent>
            <TabsContent value="waste">
              <WastePanel />
            </TabsContent>
            <TabsContent value="transfers">
              <TransfersPanel />
            </TabsContent>
            <TabsContent value="movements">
              <MovementsPanel />
            </TabsContent>
            <TabsContent value="ai">
              <AiForecastPanel />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}

export function InventoryView() {
  return (
    <InventoryProvider>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <InventoryWorkspace />
      </Suspense>
    </InventoryProvider>
  );
}
