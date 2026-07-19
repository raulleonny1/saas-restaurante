/**
 * Channel dispatch adapters.
 * Without provider credentials, deliveries are simulated and persisted
 * as campaignRecipients — ready to swap for SendGrid / Twilio / FCM / Meta.
 */

import type { CampaignChannel } from "@/types/promotions";

export interface DispatchPayload {
  channel: CampaignChannel;
  to: string;
  subject?: string;
  body: string;
  customerName: string;
  campaignId: string;
}

export interface DispatchResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  simulated: boolean;
}

function hasEnv(...keys: string[]) {
  return keys.every((k) => Boolean(process.env[k]));
}

export async function dispatchMessage(
  payload: DispatchPayload,
): Promise<DispatchResult> {
  switch (payload.channel) {
    case "email":
      return dispatchEmail(payload);
    case "sms":
      return dispatchSms(payload);
    case "whatsapp":
      return dispatchWhatsapp(payload);
    case "push":
    case "in_app":
      return dispatchPush(payload);
    default:
      return { ok: false, simulated: true, error: "Canal no soportado" };
  }
}

async function dispatchEmail(payload: DispatchPayload): Promise<DispatchResult> {
  // Hook for SendGrid / Resend — simulated until keys exist
  if (hasEnv("SENDGRID_API_KEY") || hasEnv("RESEND_API_KEY")) {
    // Real provider wiring would go here
  }
  return {
    ok: true,
    simulated: true,
    providerMessageId: `email_sim_${Date.now().toString(36)}`,
  };
}

async function dispatchSms(payload: DispatchPayload): Promise<DispatchResult> {
  if (hasEnv("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN")) {
    // Twilio SMS hook
  }
  if (!payload.to.startsWith("+") && payload.to.length < 9) {
    return {
      ok: false,
      simulated: true,
      error: "Teléfono inválido para SMS",
    };
  }
  return {
    ok: true,
    simulated: true,
    providerMessageId: `sms_sim_${Date.now().toString(36)}`,
  };
}

async function dispatchWhatsapp(
  payload: DispatchPayload,
): Promise<DispatchResult> {
  if (hasEnv("META_WHATSAPP_TOKEN", "META_WHATSAPP_PHONE_ID")) {
    // Meta Cloud API hook
  }
  return {
    ok: true,
    simulated: true,
    providerMessageId: `wa_sim_${Date.now().toString(36)}`,
  };
}

async function dispatchPush(payload: DispatchPayload): Promise<DispatchResult> {
  // FCM / web push hook — always persist as in-app notification path
  return {
    ok: true,
    simulated: true,
    providerMessageId: `push_sim_${payload.to.slice(0, 8)}_${Date.now().toString(36)}`,
  };
}

export function personalizeBody(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}
