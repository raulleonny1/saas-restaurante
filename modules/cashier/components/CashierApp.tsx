"use client";

import { useAuth } from "@/context/AuthProvider";
import {
  homePathForRole,
  isCashierOnlyRole,
  isWaiterOnlyRole,
} from "@/lib/roles";
import { CashierWaiterPrintListener } from "@/modules/cashier/components/CashierWaiterPrintListener";
import { FloorRoutesProvider } from "@/modules/floor/FloorRoutesContext";
import { PosProvider } from "@/modules/pos/context/PosProvider";
import { WaiterShell } from "@/modules/waiter/components/WaiterShell";
import { WaiterNotificationsProvider } from "@/modules/waiter/context/WaiterNotificationsProvider";
import { Alert } from "@/ui";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

function AccessGate({ children }: { children: ReactNode }) {
  const { can, user, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || !role) return;
    // Mesero no usa /caja
    if (isWaiterOnlyRole(role)) {
      router.replace(homePathForRole(role));
    }
  }, [user, role, router]);

  if (!user) return <>{children}</>;
  if (isWaiterOnlyRole(role)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] text-[#e7efe4]">
        Redirigiendo a sala…
      </div>
    );
  }
  if (!can("pos.access") && !can("payments.charge")) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] p-6">
        <Alert tone="warning" title="Sin acceso a caja">
          Tu rol no tiene permiso de cobro / POS.
        </Alert>
      </div>
    );
  }
  if (
    role &&
    !isCashierOnlyRole(role) &&
    role !== "propietario" &&
    role !== "gerente" &&
    role !== "supervisor" &&
    role !== "super_admin"
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] p-6">
        <Alert tone="warning" title="App de cajeros">
          Esta pantalla es para cajeros. Tu inicio es {homePathForRole(role)}.
        </Alert>
      </div>
    );
  }
  return <>{children}</>;
}

export function CashierApp({ children }: { children: ReactNode }) {
  return (
    <FloorRoutesProvider base="/caja">
      <PosProvider>
        <AccessGate>
          <WaiterNotificationsProvider>
            <CashierWaiterPrintListener />
            <WaiterShell>{children}</WaiterShell>
          </WaiterNotificationsProvider>
        </AccessGate>
      </PosProvider>
    </FloorRoutesProvider>
  );
}
