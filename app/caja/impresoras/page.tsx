import { redirect } from "next/navigation";

/** Impresoras se configuran en Ajustes. */
export default function CajaImpresorasPage() {
  redirect("/settings?tab=printers");
}
