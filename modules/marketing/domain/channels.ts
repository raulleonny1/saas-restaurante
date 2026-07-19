import type { CampaignChannel } from "@/types/promotions";

export const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push",
  in_app: "In-app",
};

export const CHANNELS: CampaignChannel[] = [
  "email",
  "sms",
  "whatsapp",
  "push",
  "in_app",
];
