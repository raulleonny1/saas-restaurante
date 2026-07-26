"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Redirige a Ajustes → Impresoras (configuración unificada). */
export function CashierPrintersPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings?tab=printers");
  }, [router]);
  return (
    <div className="py-8 text-sm text-[#a8b5a4]">
      Abriendo Ajustes · Impresoras…
    </div>
  );
}
