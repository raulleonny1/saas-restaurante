"use client";

import { useAuth } from "@/context/AuthProvider";
import { FloorPlan } from "@/modules/pos/components/FloorPlan";
import { HistoryDrawer } from "@/modules/pos/components/HistoryDrawer";
import { MergeTablesModal } from "@/modules/pos/components/MergeTablesModal";
import { MoveTableModal } from "@/modules/pos/components/MoveTableModal";
import { OfflineBanner } from "@/modules/pos/components/OfflineBanner";
import { PaymentModal } from "@/modules/pos/components/PaymentModal";
import { ProductGrid } from "@/modules/pos/components/ProductGrid";
import { SplitBillModal } from "@/modules/pos/components/SplitBillModal";
import { TicketPanel } from "@/modules/pos/components/TicketPanel";
import { PosProvider, usePos } from "@/modules/pos/context/PosProvider";
import {
  Alert,
  Badge,
  Button,
  PageHeader,
  Select,
  Skeleton,
  toast,
} from "@/ui";
import { History, LayoutGrid } from "lucide-react";
import { useState } from "react";

function PosWorkspace() {
  const { can } = useAuth();
  const {
    ready,
    error,
    branches,
    branchId,
    setBranchId,
    tables,
    products,
    selectedTableId,
    activeOrder,
    bootstrap,
  } = usePos();

  const [payOpen, setPayOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"floor" | "ticket">("floor");
  const [bootstrapping, setBootstrapping] = useState(false);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!can("pos.access") && !can("orders.create")) {
    return (
      <Alert tone="warning" title="Sin acceso al POS">
        Tu rol no tiene permiso `pos.access`.
      </Alert>
    );
  }

  const needsBootstrap = tables.length === 0 || products.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col pb-20 lg:pb-0">
      <PageHeader
        title="POS"
        description="Plano, ticket y cobro en tiempo real con Firestore."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {branchId && branches.length > 0 ? (
              <Select
                aria-label="Sucursal"
                className="w-full sm:min-w-[180px]"
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" /> Historial
            </Button>
            {needsBootstrap ? (
              <Button
                size="sm"
                disabled={bootstrapping}
                onClick={() => {
                  void (async () => {
                    try {
                      setBootstrapping(true);
                      const res = await bootstrap();
                      toast(
                        `POS listo: ${res.tablesCreated} mesas, ${res.productsCreated} productos en Firestore`,
                        "success",
                      );
                    } catch (e) {
                      toast(
                        e instanceof Error ? e.message : "Error bootstrap",
                        "error",
                      );
                    } finally {
                      setBootstrapping(false);
                    }
                  })();
                }}
              >
                <LayoutGrid className="h-4 w-4" /> Preparar POS
              </Button>
            ) : null}
          </div>
        }
      />

      <OfflineBanner />

      {error ? (
        <Alert tone="danger" title="Error Firestore" className="mb-4">
          {error}
        </Alert>
      ) : null}

      {/* Mobile tabs: floor vs ticket */}
      <div className="mb-3 grid grid-cols-2 gap-2 lg:hidden">
        <Button
          variant={mobileTab === "floor" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMobileTab("floor")}
        >
          Plano
        </Button>
        <Button
          variant={mobileTab === "ticket" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setMobileTab("ticket")}
        >
          Ticket
          {selectedTableId ? (
            <Badge tone="accent" className="ml-1">
              ·
            </Badge>
          ) : null}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.95fr)_minmax(260px,0.9fr)]">
        <section
          className={`min-h-0 rounded-[var(--radius-xl)] border border-border bg-bg-elevated/60 p-3 sm:p-4 ${
            mobileTab === "floor" ? "block" : "hidden xl:block"
          }`}
        >
          <h2 className="mb-3 text-sm font-medium text-fg-muted">
            Plano de mesas
          </h2>
          <FloorPlan />
        </section>

        <section
          className={`min-h-[420px] ${
            mobileTab === "ticket" ? "block" : "hidden xl:block"
          }`}
        >
          <TicketPanel
            onPay={() => setPayOpen(true)}
            onMove={() => setMoveOpen(true)}
            onMerge={() => setMergeOpen(true)}
            onSplit={() => setSplitOpen(true)}
          />
        </section>

        <section
          className={`min-h-0 rounded-[var(--radius-xl)] border border-border bg-bg-elevated/60 p-3 sm:p-4 ${
            mobileTab === "ticket" ? "block" : "hidden xl:block"
          }`}
        >
          <h2 className="mb-3 text-sm font-medium text-fg-muted">Carta</h2>
          <div className="max-h-[70vh] overflow-y-auto xl:max-h-[calc(100vh-14rem)]">
            <ProductGrid disabled={!activeOrder} />
          </div>
        </section>
      </div>

      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
      <MoveTableModal open={moveOpen} onClose={() => setMoveOpen(false)} />
      <MergeTablesModal open={mergeOpen} onClose={() => setMergeOpen(false)} />
      <SplitBillModal open={splitOpen} onClose={() => setSplitOpen(false)} />
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

export function PosView() {
  return (
    <PosProvider>
      <PosWorkspace />
    </PosProvider>
  );
}
