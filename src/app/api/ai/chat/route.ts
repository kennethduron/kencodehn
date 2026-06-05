import { NextRequest, NextResponse } from "next/server";
import { checkAiGuardrails, SAFE_AI_FALLBACK } from "@/lib/ai/guardrails";
import { findKnowledgeAnswer } from "@/lib/ai/knowledge";

export const runtime = "nodejs";

type ChatPayload = {
  message?: unknown;
};

function isChatPayload(value: unknown): value is ChatPayload {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: NextRequest) {
  try {
    const payload: unknown = await request.json();

    if (!isChatPayload(payload) || typeof payload.message !== "string" || payload.message.trim().length === 0) {
      return NextResponse.json(
        {
          ok: false,
          answer: SAFE_AI_FALLBACK,
          message: "Debe enviar un mensaje válido.",
        },
        { status: 400 },
      );
    }

    const message = payload.message.trim();
    const guardrails = checkAiGuardrails(message);

    if (guardrails.blocked) {
      return NextResponse.json({
        ok: true,
        answer: guardrails.response,
      });
    }

    const knowledgeAnswer = findKnowledgeAnswer(message);

    return NextResponse.json({
      ok: true,
      answer: knowledgeAnswer.answer,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        answer: SAFE_AI_FALLBACK,
        message: "No fue posible procesar el mensaje.",
      },
      { status: 400 },
    );
  }
}
