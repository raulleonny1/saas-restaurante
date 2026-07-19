import type { LlmPort, LlmRewriteInput } from "@/modules/ai/ports/llm.port";

/**
 * OpenAI adapter — server-only. Never import from POS/inventory modules.
 */
export function createOpenAiAdapter(apiKey: string): LlmPort {
  return {
    async rewriteManagerAnswer(input: LlmRewriteInput): Promise<string | null> {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            {
              role: "system",
              content:
                "Eres el gerente inteligente de SmartServe AI para un restaurante/café. Respondes en español, claro y accionable. Usa SOLO los hallazgos del brief JSON; no inventes cifras. Tono profesional cercano. Estructura: diagnóstico breve, hallazgos con datos, 2-4 acciones. Sin markdown excesivo.",
            },
            {
              role: "user",
              content: `Pregunta del gerente:\n${input.question}\n\nBrief analítico (JSON):\n${input.briefJson}\n\nBorrador local:\n${input.draftAnswer}\n\nReescribe la respuesta final como gerente.`,
            },
          ],
        }),
      });

      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content?.trim() || null;
    },
  };
}
