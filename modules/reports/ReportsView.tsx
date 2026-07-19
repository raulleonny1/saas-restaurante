"use client";

import { useAuth } from "@/context/AuthProvider";
import { ExportBar } from "@/modules/reports/components/ExportBar";
import { PeriodControls } from "@/modules/reports/components/PeriodControls";
import {
  ComparePanel,
  CustomersPanel,
  EmployeesPanel,
  InventoryPanel,
  PeaksPanel,
  ProductsPanel,
  ProfitPanel,
  SalesPanel,
} from "@/modules/reports/components/ReportPanels";
import {
  ReportsProvider,
  useReports,
  type ReportTab,
} from "@/modules/reports/context/ReportsProvider";
import {
  Alert,
  Badge,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@/ui";
import { useState } from "react";

const TABS: { id: ReportTab; label: string }[] = [
  { id: "sales", label: "Ventas" },
  { id: "profit", label: "Utilidad" },
  { id: "products", label: "Productos" },
  { id: "customers", label: "Clientes" },
  { id: "inventory", label: "Inventario" },
  { id: "employees", label: "Empleados" },
  { id: "peaks", label: "Horas pico" },
  { id: "compare", label: "Comparativas" },
];

function ReportsWorkspace() {
  const { can } = useAuth();
  const {
    ready,
    error,
    range,
    preset,
    setPreset,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    exportTab,
  } = useReports();
  const [tab, setTab] = useState<ReportTab>("sales");
  const [exporting, setExporting] = useState(false);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!can("reports.read")) {
    return (
      <Alert tone="warning" title="Sin acceso a reportes">
        Tu rol no tiene permiso `reports.read`.
      </Alert>
    );
  }

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <PageHeader
        title="Reportes"
        description="Ventas, utilidad, productos, clientes, inventario, empleados, horas pico y comparativas — con exportación PDF, Excel y CSV."
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Badge tone="accent">{range.label}</Badge>
            <ExportBar
              busy={exporting}
              onExport={(format) => {
                void (async () => {
                  try {
                    setExporting(true);
                    await exportTab(tab, format);
                    toast(`Exportado ${format.toUpperCase()}`, "success");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Error al exportar", "error");
                  } finally {
                    setExporting(false);
                  }
                })();
              }}
            />
          </div>
        }
      />

      <PeriodControls
        preset={preset}
        onPreset={setPreset}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
      />

      {error ? (
        <Alert tone="danger" title="Error Firestore">
          {error}
        </Alert>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ReportTab)}
      >
        <TabsList className="mb-2 flex h-auto w-full flex-wrap justify-start">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="sales">
          <SalesPanel />
        </TabsContent>
        <TabsContent value="profit">
          <ProfitPanel />
        </TabsContent>
        <TabsContent value="products">
          <ProductsPanel />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersPanel />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryPanel />
        </TabsContent>
        <TabsContent value="employees">
          <EmployeesPanel />
        </TabsContent>
        <TabsContent value="peaks">
          <PeaksPanel />
        </TabsContent>
        <TabsContent value="compare">
          <ComparePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ReportsView() {
  return (
    <ReportsProvider>
      <ReportsWorkspace />
    </ReportsProvider>
  );
}
