"use client";

import {
  answerLocally,
  buildLlmBrief,
  type ManagerAnswer,
} from "@/modules/ai/application/answer";
import type { BusinessSnapshot } from "@/modules/ai/domain/snapshot";

/**
 * Facade: analyze DB locally, optionally polish with /api/ai/chat (OpenAI).
 */
export async function askManager(
  snap: BusinessSnapshot,
  question: string,
): Promise<ManagerAnswer> {
  const local = answerLocally(snap, question);

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        draftAnswer: local.content,
        briefJson: buildLlmBrief(snap, local.finding),
      }),
    });
    if (!res.ok) return local;
    const data = (await res.json()) as {
      answer?: string;
      model?: string;
      llm?: boolean;
    };
    if (!data.answer) return local;
    return {
      ...local,
      content: data.answer,
      model: data.model ?? local.model,
    };
  } catch {
    return local;
  }
}
