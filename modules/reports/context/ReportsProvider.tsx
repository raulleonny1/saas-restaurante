"use client";

import { useRestaurant } from "@/context/RestaurantProvider";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  buildComparativesReport,
  buildCustomersReport,
  buildEmployeesReport,
  buildInventoryReport,
  buildPeakHoursReport,
  buildProductsReport,
  buildProfitReport,
  buildSalesReport,
  type ComparativesReportData,
  type CustomersReportData,
  type EmployeesReportData,
  type InventoryReportData,
  type PeakHoursReportData,
  type ProductsReportData,
  type ProfitReportData,
  type SalesReportData,
} from "@/modules/reports/domain/aggregates";
import {
  resolvePeriod,
  type DateRange,
  type ReportPeriodPreset,
} from "@/modules/reports/domain/period";
import {
  exportBundle,
  namedTable,
  seriesTable,
  type ExportFormat,
} from "@/modules/reports/services/export.service";
import {
  subscribeCategories,
  subscribeCustomers,
  subscribeEmployees,
  subscribeIngredients,
  subscribeInventoryLevels,
  subscribeOrders,
  subscribeProducts,
  subscribeShifts,
  subscribeWaste,
} from "@/modules/reports/services/reports-data.service";
import type { Ingredient, Product, ProductCategory } from "@/types/catalog";
import type { Customer } from "@/types/customers";
import type { Employee, EmployeeShift } from "@/types/employees";
import type { InventoryLevel, WasteEntry } from "@/types/inventory";
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

export type ReportTab =
  | "sales"
  | "profit"
  | "products"
  | "customers"
  | "inventory"
  | "employees"
  | "peaks"
  | "compare";

interface ReportsContextValue {
  ready: boolean;
  error: string | null;
  currency: string;
  preset: ReportPeriodPreset;
  setPreset: (p: ReportPeriodPreset) => void;
  customFrom: string;
  customTo: string;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
  range: DateRange;
  sales: SalesReportData;
  profit: ProfitReportData;
  products: ProductsReportData;
  customers: CustomersReportData;
  inventory: InventoryReportData;
  employees: EmployeesReportData;
  peaks: PeakHoursReportData;
  compare: ComparativesReportData;
  exportTab: (tab: ReportTab, format: ExportFormat) => Promise<void>;
}

const ReportsContext = createContext<ReportsContextValue | null>(null);

export function useReports() {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error("useReports requires provider");
  return ctx;
}

export function ReportsProvider({ children }: { children: ReactNode }) {
  const { restaurant, restaurantId } = useRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [levels, setLevels] = useState<InventoryLevel[]>([]);
  const [waste, setWaste] = useState<WasteEntry[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [preset, setPreset] = useState<ReportPeriodPreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const currency = restaurant?.currency ?? "EUR";

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
    setReady(false);

    const unsubs = [
      subscribeOrders(
        restaurantId,
        (rows) => {
          setOrders(rows);
          setReady(true);
        },
        (e) => setError(e.message),
      ),
      subscribeProducts(restaurantId, setProductsList, (e) => setError(e.message)),
      subscribeCategories(restaurantId, setCategories, (e) => setError(e.message)),
      subscribeIngredients(restaurantId, setIngredients, (e) => setError(e.message)),
      subscribeCustomers(restaurantId, setCustomersList, (e) => setError(e.message)),
      subscribeInventoryLevels(restaurantId, setLevels, (e) => setError(e.message)),
      subscribeWaste(restaurantId, setWaste, (e) => setError(e.message)),
      subscribeEmployees(restaurantId, setEmployeesList, (e) => setError(e.message)),
      subscribeShifts(restaurantId, setShifts, (e) => setError(e.message)),
    ];

    return () => unsubs.forEach((u) => u());
  }, [restaurantId]);

  const range = useMemo(
    () => resolvePeriod(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const sales = useMemo(
    () => buildSalesReport(orders, range),
    [orders, range],
  );
  const profit = useMemo(
    () =>
      buildProfitReport(orders, productsList, ingredients, waste, range),
    [orders, productsList, ingredients, waste, range],
  );
  const products = useMemo(() => {
    const names = new Map(categories.map((c) => [c.id, c.name]));
    return buildProductsReport(orders, productsList, range, names);
  }, [orders, productsList, categories, range]);
  const customers = useMemo(
    () => buildCustomersReport(customersList, orders, range),
    [customersList, orders, range],
  );
  const inventory = useMemo(
    () => buildInventoryReport(levels, ingredients, waste, range),
    [levels, ingredients, waste, range],
  );
  const employees = useMemo(
    () => buildEmployeesReport(employeesList, shifts, orders, range),
    [employeesList, shifts, orders, range],
  );
  const peaks = useMemo(
    () => buildPeakHoursReport(orders, range),
    [orders, range],
  );
  const compare = useMemo(
    () =>
      buildComparativesReport(
        orders,
        productsList,
        ingredients,
        waste,
        range,
      ),
    [orders, productsList, ingredients, waste, range],
  );

  const exportTab = useCallback(
    async (tab: ReportTab, format: ExportFormat) => {
      const stamp = new Date().toISOString().slice(0, 10);
      const subtitle = `${range.label} · ${range.from.toLocaleDateString("es")} – ${range.to.toLocaleDateString("es")}`;
      const filename = `smartserve_${tab}_${stamp}`;

      const tables = (() => {
        switch (tab) {
          case "sales":
            return [
              {
                title: "KPIs ventas",
                columns: ["Métrica", "Valor"],
                rows: [
                  ["Ingresos", sales.revenue],
                  ["Pedidos", sales.orders],
                  ["Ticket medio", sales.avgTicket],
                  ["Propinas", sales.tips],
                  ["Descuentos", sales.discounts],
                  ["Comensales", sales.guests],
                ],
              },
              seriesTable("Ventas por día", sales.byDay, "Ingresos"),
              namedTable("Por canal", sales.byChannel, "Ingresos"),
            ];
          case "profit":
            return [
              {
                title: "Utilidad",
                columns: ["Métrica", "Valor"],
                rows: [
                  ["Ingresos", profit.revenue],
                  ["Coste estimado", profit.estimatedCost],
                  ["Merma", profit.wasteCost],
                  ["Beneficio bruto", profit.grossProfit],
                  ["Margen", Math.round(profit.margin * 1000) / 10 + "%"],
                ],
              },
              seriesTable(
                "Beneficio diario",
                profit.byDay,
                "Beneficio",
                "Ingresos",
              ),
            ];
          case "products":
            return [
              namedTable("Top ingresos", products.topByRevenue, "Ingresos"),
              namedTable("Top unidades", products.topByQty, "Ud."),
              namedTable("Mix categoría", products.categoryMix, "Ingresos"),
            ];
          case "customers":
            return [
              {
                title: "Clientes",
                columns: ["Métrica", "Valor"],
                rows: [
                  ["Activos", customers.active],
                  ["Nuevos", customers.newInPeriod],
                  ["Recurrentes", customers.returning],
                  ["LTV medio", customers.avgLtv],
                ],
              },
              namedTable("Top gastadores", customers.topSpenders, "Gasto"),
              namedTable("Por tier", customers.byTier, "Clientes"),
            ];
          case "inventory":
            return [
              {
                title: "Inventario",
                columns: ["Métrica", "Valor"],
                rows: [
                  ["SKUs", inventory.skus],
                  ["Bajo mínimo", inventory.lowStock],
                  ["Valor stock", inventory.stockValue],
                  ["Coste merma", inventory.wasteCost],
                ],
              },
              namedTable("Bajo stock", inventory.lowStockItems, "Cantidad"),
              namedTable("Merma por motivo", inventory.wasteByReason, "Coste"),
            ];
          case "employees":
            return [
              {
                title: "Empleados",
                columns: ["Métrica", "Valor"],
                rows: [
                  ["Activos", employees.active],
                  ["Horas turno", Math.round(employees.shiftHours * 10) / 10],
                ],
              },
              namedTable("Ventas por empleado", employees.bySales, "Ingresos"),
              namedTable("Horas por empleado", employees.byHours, "Horas"),
            ];
          case "peaks":
            return [
              seriesTable("Por hora", peaks.byHour, "Ingresos"),
              namedTable("Por día semana", peaks.byWeekday, "Ingresos"),
            ];
          case "compare":
            return [
              {
                title: "Comparativa",
                columns: ["Métrica", "Actual", "Anterior", "Δ %"],
                rows: [
                  [
                    "Ingresos",
                    compare.current.revenue,
                    compare.previous.revenue,
                    Math.round(compare.deltas.revenue * 1000) / 10,
                  ],
                  [
                    "Pedidos",
                    compare.current.orders,
                    compare.previous.orders,
                    Math.round(compare.deltas.orders * 1000) / 10,
                  ],
                  [
                    "Ticket",
                    compare.current.avgTicket,
                    compare.previous.avgTicket,
                    Math.round(compare.deltas.avgTicket * 1000) / 10,
                  ],
                  [
                    "Beneficio",
                    compare.current.profit,
                    compare.previous.profit,
                    Math.round(compare.deltas.profit * 1000) / 10,
                  ],
                ],
              },
              seriesTable(
                "Serie comparada",
                compare.series,
                "Actual",
                "Anterior",
              ),
            ];
        }
      })();

      await exportBundle(format, { filename, subtitle, tables });
    },
    [
      range,
      sales,
      profit,
      products,
      customers,
      inventory,
      employees,
      peaks,
      compare,
    ],
  );

  const value: ReportsContextValue = {
    ready,
    error,
    currency,
    preset,
    setPreset,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    range,
    sales,
    profit,
    products,
    customers,
    inventory,
    employees,
    peaks,
    compare,
    exportTab,
  };

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  );
}
