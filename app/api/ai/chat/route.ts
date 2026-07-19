import { createOpenAiAdapter } from "@/modules/ai/adapters/openai.adapter";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface Body {
  question?: string;
  draftAnswer?: string;
  briefJson?: string;
}

/**
 * Optional LLM polish for the AI manager.
 * Analysis always runs client-side; this only rewrites tone if OPENAI_API_KEY is set.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const question = body.question?.trim();
    const draftAnswer = body.draftAnswer?.trim();
    const briefJson = body.briefJson?.trim();

    if (!question || !draftAnswer || !briefJson) {
      return NextResponse.json(
        { error: "question, draftAnswer y briefJson son requeridos" },
        { status: 400 },
      );
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({
        answer: draftAnswer,
        model: "smartserve-manager-local",
        llm: false,
      });
    }

    const llm = createOpenAiAdapter(key);
    const polished = await llm.rewriteManagerAnswer({
      question,
      briefJson,
      draftAnswer,
    });

    return NextResponse.json({
      answer: polished || draftAnswer,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      llm: Boolean(polished),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error IA" },
      { status: 500 },
    );
  }
}
