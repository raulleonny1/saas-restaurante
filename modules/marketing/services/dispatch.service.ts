/**
 * Channel dispatch adapters.
 * Con credenciales → SendGrid/Resend, Twilio, Meta WhatsApp, FCM.
 * Sin clave → simulated: true (no rompe demos).
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
  if (hasEnv("RESEND_API_KEY")) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "SmartServe <onboarding@resend.dev>",
          to: [payload.to],
          subject: payload.subject || "Promoción",
          text: payload.body,
        }),
      });
      const data = (await res.json()) as { id?: string; message?: string };
      if (!res.ok) {
        return {
          ok: false,
          simulated: false,
          error: data.message || `Resend ${res.status}`,
        };
      }
      return {
        ok: true,
        simulated: false,
        providerMessageId: data.id || `resend_${Date.now().toString(36)}`,
      };
    } catch (e) {
      return {
        ok: false,
        simulated: false,
        error: e instanceof Error ? e.message : "Resend error",
      };
    }
  }

  if (hasEnv("SENDGRID_API_KEY")) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: {
            email: process.env.SENDGRID_FROM || "noreply@smartserve.app",
          },
          subject: payload.subject || "Promoción",
          content: [{ type: "text/plain", value: payload.body }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, simulated: false, error: text || `SendGrid ${res.status}` };
      }
      return {
        ok: true,
        simulated: false,
        providerMessageId: `sg_${Date.now().toString(36)}`,
      };
    } catch (e) {
      return {
        ok: false,
        simulated: false,
        error: e instanceof Error ? e.message : "SendGrid error",
      };
    }
  }

  return {
    ok: true,
    simulated: true,
    providerMessageId: `email_sim_${Date.now().toString(36)}`,
  };
}

async function dispatchSms(payload: DispatchPayload): Promise<DispatchResult> {
  if (!payload.to.startsWith("+") && payload.to.length < 9) {
    return {
      ok: false,
      simulated: true,
      error: "Teléfono inválido para SMS",
    };
  }

  if (hasEnv("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM")) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const token = process.env.TWILIO_AUTH_TOKEN!;
      const from = process.env.TWILIO_FROM!;
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const body = new URLSearchParams({
        To: payload.to.startsWith("+") ? payload.to : `+${payload.to}`,
        From: from,
        Body: payload.body.slice(0, 1600),
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      const data = (await res.json()) as { sid?: string; message?: string };
      if (!res.ok) {
        return {
          ok: false,
          simulated: false,
          error: data.message || `Twilio ${res.status}`,
        };
      }
      return {
        ok: true,
        simulated: false,
        providerMessageId: data.sid || `tw_${Date.now().toString(36)}`,
      };
    } catch (e) {
      return {
        ok: false,
        simulated: false,
        error: e instanceof Error ? e.message : "Twilio error",
      };
    }
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
    try {
      const phoneId = process.env.META_WHATSAPP_PHONE_ID!;
      const to = payload.to.replace(/\D/g, "");
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: payload.body.slice(0, 4000) },
          }),
        },
      );
      const data = (await res.json()) as {
        messages?: { id: string }[];
        error?: { message?: string };
      };
      if (!res.ok) {
        return {
          ok: false,
          simulated: false,
          error: data.error?.message || `Meta ${res.status}`,
        };
      }
      return {
        ok: true,
        simulated: false,
        providerMessageId:
          data.messages?.[0]?.id || `wa_${Date.now().toString(36)}`,
      };
    } catch (e) {
      return {
        ok: false,
        simulated: false,
        error: e instanceof Error ? e.message : "WhatsApp error",
      };
    }
  }

  return {
    ok: true,
    simulated: true,
    providerMessageId: `wa_sim_${Date.now().toString(36)}`,
  };
}

async function dispatchPush(payload: DispatchPayload): Promise<DispatchResult> {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";
    const origin = base.startsWith("http") ? base : `https://${base}`;
    const res = await fetch(`${origin}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokens: payload.to.includes(":") ? [payload.to] : undefined,
        targetUids: payload.to.includes(":") ? undefined : [payload.to],
        title: payload.subject || "Promoción",
        body: payload.body,
        data: { campaignId: payload.campaignId },
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      simulated?: boolean;
      sent?: number;
    };
    return {
      ok: Boolean(data.ok),
      simulated: Boolean(data.simulated ?? true),
      providerMessageId: `push_${payload.to.slice(0, 8)}_${Date.now().toString(36)}`,
    };
  } catch {
    return {
      ok: true,
      simulated: true,
      providerMessageId: `push_sim_${payload.to.slice(0, 8)}_${Date.now().toString(36)}`,
    };
  }
}

export function personalizeBody(
  template: string,
  vars: Record<string, string>,
): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, v),
    template,
  );
}
