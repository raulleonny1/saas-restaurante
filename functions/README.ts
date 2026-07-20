/**
 * Cloud Functions scaffold (Fase backend).
 * Despliegue: `firebase deploy --only functions` cuando el proyecto tenga functions/.
 *
 * Responsabilidades previstas (no en cliente):
 * - Webhooks Stripe / SumUp → completar payments
 * - Envío Verifactu AEAT
 * - changePlan / markInvoicePaid / updateMember role
 * - Rebuild nocturno dailyStats
 *
 * Las rutas Next `/api/admin/*` y `/api/payments/*` cubren el mismo rol
 * en Vercel hasta migrar a este paquete.
 */

export const CRITICAL_BACKEND_OWNERS = [
  "billing.changePlan",
  "billing.markInvoicePaid",
  "members.updateRole",
  "payments.webhooks",
  "fiscal.aeatSubmit",
  "reports.rebuildDailyStats",
] as const;

export function backendReady(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}
