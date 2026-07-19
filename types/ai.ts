import type { ISODateString, SoftDelete, Timestamps } from "./common";

export type AiMessageRole = "user" | "assistant" | "system";

export type AiInsightType =
  | "sales_drop"
  | "stock_prediction"
  | "promotion_suggestion"
  | "employee_performance"
  | "demand_forecast"
  | "custom";

export type AiInsightStatus = "new" | "seen" | "dismissed" | "acted";

export interface AiSession extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchId: string | null;
  createdBy: string;
  title?: string;
  model?: string;
  messageCount: number;
  lastMessageAt?: ISODateString;
}

export interface AiMessage extends Timestamps {
  id: string;
  restaurantId: string;
  sessionId: string;
  role: AiMessageRole;
  content: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
  };
  /** Structured tool/context payload used for the answer. */
  contextRefs?: Array<{
    type: string;
    id: string;
  }>;
}

export interface AiInsight extends Timestamps, SoftDelete {
  id: string;
  restaurantId: string;
  branchId: string | null;
  type: AiInsightType;
  status: AiInsightStatus;
  title: string;
  summary: string;
  confidence: number;
  data?: Record<string, unknown>;
  expiresAt?: ISODateString;
  generatedBy: "system" | "user_prompt";
  sessionId?: string;
}
