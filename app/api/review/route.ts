import { NextRequest, NextResponse } from "next/server";
import { createReview, type SafeReviewEvent } from "@/lib/github";
import type { ReviewRequest, ReviewResponse } from "@/lib/types";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

function buildReviewBody(req: ReviewRequest): { body: string; event: SafeReviewEvent } {
  const rejects = req.verdicts.filter((v) => v.verdict === "reject");
  const approves = req.verdicts.filter((v) => v.verdict === "approve");
  const skips = req.verdicts.filter((v) => v.verdict === "skip");

  // SAFETY: all approve → COMMENT (never APPROVE). Any reject → REQUEST_CHANGES.
  const event: SafeReviewEvent =
    rejects.length > 0 ? "REQUEST_CHANGES" : "COMMENT";

  const lines: string[] = [
    "## Swipe-to-Ship review",
    "",
  ];

  if (req.body?.trim()) {
    lines.push(req.body.trim(), "");
  }

  if (approves.length) {
    lines.push(`### Ship (${approves.length})`);
    for (const v of approves) {
      lines.push(`- ✅ **${v.cardId}**${v.comment ? `: ${v.comment}` : ""}`);
    }
    lines.push("");
  }

  if (rejects.length) {
    lines.push(`### Hold (${rejects.length})`);
    for (const v of rejects) {
      lines.push(`- ⛔ **${v.cardId}**${v.comment ? `: ${v.comment}` : ""}`);
    }
    lines.push("");
  }

  if (skips.length) {
    lines.push(`### Skipped (${skips.length})`);
    for (const v of skips) {
      lines.push(`- ⏭ **${v.cardId}**`);
    }
    lines.push("");
  }

  lines.push(
    "---",
    "_Submitted via Swipe-to-Ship. This review uses COMMENT or REQUEST_CHANGES only — it never approves or merges._"
  );

  return { body: lines.join("\n"), event };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReviewRequest;
    const prNumber = Number(body.prNumber);
    if (!Number.isFinite(prNumber) || prNumber <= 0) {
      return NextResponse.json(
        { error: "Valid prNumber is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.verdicts) || body.verdicts.length === 0) {
      return NextResponse.json(
        { error: "At least one verdict is required" },
        { status: 400 }
      );
    }

    const { body: reviewBody, event } = buildReviewBody(body);
    const review = await createReview({
      prNumber,
      body: reviewBody,
      event,
    });

    const payload: ReviewResponse = {
      html_url: review.html_url,
      event,
      id: review.id,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
