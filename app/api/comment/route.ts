import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/openrouter";
import { VOICE_COMMENT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { CommentRequest, CommentResponse } from "@/lib/types";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CommentRequest;
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    const context = body.cardTitle
      ? `Card under review: ${body.cardTitle}\n\nSpoken feedback:\n${transcript}`
      : `Spoken feedback:\n${transcript}`;

    const comment = await chatCompletion(VOICE_COMMENT_SYSTEM_PROMPT, context, {
      temperature: 0.3,
      maxTokens: 400,
    });

    const payload: CommentResponse = { comment: comment.replace(/^["']|["']$/g, "").trim() };
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to rewrite comment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
