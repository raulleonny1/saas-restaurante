"use client";

import { useAuth } from "@/context/AuthProvider";
import { homePathForRole } from "@/lib/roles";
import { DeliveryBoard } from "@/modules/delivery/components/DeliveryBoard";
import { DeliveryProvider } from "@/modules/delivery/context/DeliveryProvider";
import { Alert } from "@/ui";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

function AccessGate({ children }: { children: ReactNode }) {
  const { can, user, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || !role) return;
    if (
      role !== "repartidor" &&
      role !== "propietario" &&
      role !== "gerente" &&
      role !== "supervisor" &&
      role !== "super_admin" &&
      !can("delivery.access")
    ) {
      router.replace(homePathForRole(role));
    }
  }, [user, role, can, router]);

  if (!user) return <>{children}</>;
  if (
    !can("delivery.access") &&
    role !== "repartidor" &&
    role !== "propietario" &&
    role !== "gerente" &&
    role !== "supervisor" &&
    role !== "super_admin"
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0e1410] p-6">
        <Alert tone="warning" title="Sin acceso a repartos">
          Tu rol no tiene permiso delivery.access.
        </Alert>
      </div>
    );
  }
  return <>{children}</>;
}

export function DeliveryApp({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0e1410] text-[#e7efe4]">
      <DeliveryProvider>
        <AccessGate>{children ?? <DeliveryBoard />}</AccessGate>
      </DeliveryProvider>
    </div>
  );
}
