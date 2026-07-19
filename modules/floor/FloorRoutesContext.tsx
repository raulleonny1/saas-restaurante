"use client";

import { createContext, useContext, type ReactNode } from "react";

export type FloorBasePath = "/waiter" | "/caja";

type FloorRoutes = {
  base: FloorBasePath;
  home: string;
  order: string;
  pay: string;
  qr: string;
  history: string;
  notifications: string;
  move: string;
};

const WaiterRoutes: FloorRoutes = {
  base: "/waiter",
  home: "/waiter",
  order: "/waiter/pedido",
  pay: "/waiter/cobrar",
  qr: "/waiter/qr",
  history: "/waiter/historial",
  notifications: "/waiter/notificaciones",
  move: "/waiter/mover",
};

const CashierRoutes: FloorRoutes = {
  base: "/caja",
  home: "/caja",
  order: "/caja/pedido",
  pay: "/caja/cobrar",
  qr: "/caja/qr",
  history: "/caja/historial",
  notifications: "/caja/notificaciones",
  move: "/caja/mover",
};

const FloorRoutesContext = createContext<FloorRoutes>(WaiterRoutes);

export function FloorRoutesProvider({
  base,
  children,
}: {
  base: FloorBasePath;
  children: ReactNode;
}) {
  const value = base === "/caja" ? CashierRoutes : WaiterRoutes;
  return (
    <FloorRoutesContext.Provider value={value}>
      {children}
    </FloorRoutesContext.Provider>
  );
}

export function useFloorRoutes(): FloorRoutes {
  return useContext(FloorRoutesContext);
}
