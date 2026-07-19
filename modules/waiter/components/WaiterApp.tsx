"use client";

import { useAuth } from "@/context/AuthProvider";
import { PosProvider } from "@/modules/pos/context/PosProvider";
import { WaiterShell } from "@/modules/waiter/components/WaiterShell";
import {
  WaiterNotificationsProvider,
  useWaiterNotifications,
} from "@/modules/waiter/context/WaiterNotificationsProvider";
import { Alert } from "@/ui";
import type { ReactNode } from "react";

function ShellWithUnread({ children }: { children: ReactNode }) {
  const { unread } = useWaiterNotifications();
  return <WaiterShell unread={unread}>{children}</WaiterShell>;
}

function AccessGate({ children }: { children: ReactNode }) {
  const { can, user } = useAuth();
  if (!user) return <>{children}</>;
  if (!can("pos.access") && !can("orders.create")) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] p-6">
        <Alert tone="warning" title="Sin acceso a sala">
          Tu rol no tiene permiso de POS / pedidos.
        </Alert>
      </div>
    );
  }
  return <>{children}</>;
}

export function WaiterApp({ children }: { children: ReactNode }) {
  return (
    <PosProvider>
      <AccessGate>
        <WaiterNotificationsProvider>
          <ShellWithUnread>{children}</ShellWithUnread>
        </WaiterNotificationsProvider>
      </AccessGate>
    </PosProvider>
  );
}
