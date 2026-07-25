"use client";

import { useAuth } from "@/context/AuthProvider";
import {
  homePathForRole,
  isCashierOnlyRole,
  isWaiterOnlyRole,
} from "@/lib/roles";
import { FloorRoutesProvider } from "@/modules/floor/FloorRoutesContext";
import { PosProvider } from "@/modules/pos/context/PosProvider";
import { WaiterShell } from "@/modules/waiter/components/WaiterShell";
import {
  WaiterNotificationsProvider,
  useWaiterNotifications,
} from "@/modules/waiter/context/WaiterNotificationsProvider";
import { Alert } from "@/ui";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

function ShellWithUnread({ children }: { children: ReactNode }) {
  const { unread } = useWaiterNotifications();
  return <WaiterShell unread={unread}>{children}</WaiterShell>;
}

function AccessGate({ children }: { children: ReactNode }) {
  const { can, user, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || !role) return;
    // Cajero no usa /waiter
    if (isCashierOnlyRole(role)) {
      router.replace(homePathForRole(role));
    }
  }, [user, role, router]);

  if (!user) return <>{children}</>;
  if (isCashierOnlyRole(role)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] text-[#e7efe4]">
        Redirigiendo a caja…
      </div>
    );
  }
  if (!can("pos.access") && !can("orders.create")) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] p-6">
        <Alert tone="warning" title="Sin acceso a sala">
          Tu rol no tiene permiso de POS / pedidos.
        </Alert>
      </div>
    );
  }
  // Dueño/gerente pueden entrar; Camarero es el público principal
  if (
    role &&
    !isWaiterOnlyRole(role) &&
    role !== "propietario" &&
    role !== "gerente" &&
    role !== "supervisor" &&
    role !== "super_admin"
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] p-6">
        <Alert tone="warning" title="App de Camareros">
          Esta pantalla es para Camareros. Tu inicio es {homePathForRole(role)}.
        </Alert>
      </div>
    );
  }
  return <>{children}</>;
}

export function WaiterApp({ children }: { children: ReactNode }) {
  return (
    <FloorRoutesProvider base="/waiter">
      <PosProvider>
        <AccessGate>
          <WaiterNotificationsProvider>
            <ShellWithUnread>{children}</ShellWithUnread>
          </WaiterNotificationsProvider>
        </AccessGate>
      </PosProvider>
    </FloorRoutesProvider>
  );
}
