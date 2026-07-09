import { NextRequest, NextResponse } from "next/server";
import {
  getDiff,
  getFiles,
  getPR,
  PRNumberError,
  resolvePRNumber,
  resolveRepo,
} from "@/lib/github";
import {
  chatCompletion,
  parseJsonWithRetryPrep,
  stripJsonFences,
} from "@/lib/openrouter";
import { CARD_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import type {
  DecisionCard,
  HousekeepingCard,
  PRMeta,
  PRResponse,
  ReviewCard,
} from "@/lib/types";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

type CacheEntry = { at: number; payload: PRResponse };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(owner: string, repo: string, prNumber: number) {
  return `${owner}/${repo}#${prNumber}`;
}

function isDecisionCard(c: Record<string, unknown>): boolean {
  return c.kind === "decision" || (!c.kind && typeof c.title === "string" && !Array.isArray(c.items));
}

function normalizeCards(raw: unknown): ReviewCard[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Model response was not a JSON object");
  }
  const obj = raw as { cards?: unknown };
  if (!Array.isArray(obj.cards)) {
    throw new Error('Model response missing "cards" array');
  }

  return obj.cards.map((item, index) => {
    const c = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const id =
      typeof c.id === "string" && c.id.trim()
        ? c.id.trim()
        : `card-${index + 1}`;

    if (c.kind === "housekeeping" || Array.isArray(c.items)) {
      const items = Array.isArray(c.items)
        ? c.items.map((x) => String(x))
        : [];
      const card: HousekeepingCard = {
        id,
        kind: "housekeeping",
        title: typeof c.title === "string" ? c.title : "Housekeeping",
        items,
      };
      return card;
    }

    if (isDecisionCard(c)) {
      const riskRaw = String(c.risk || "medium").toLowerCase();
      const risk =
        riskRaw === "low" || riskRaw === "high" || riskRaw === "medium"
          ? riskRaw
          : "medium";
      const card: DecisionCard = {
        id,
        kind: "decision",
        title: String(c.title || "Untitled change"),
        summary: String(c.summary || ""),
        why_it_matters: String(c.why_it_matters || ""),
        risk,
        risk_reason: String(c.risk_reason || ""),
        files: Array.isArray(c.files) ? c.files.map((f) => String(f)) : [],
        diagram:
          typeof c.diagram === "string" && c.diagram.trim()
            ? c.diagram.trim()
            : null,
        patch:
          typeof c.patch === "string" && c.patch.trim() ? c.patch.trim() : null,
      };
      return card;
    }

    // Fallback: treat as housekeeping item dump
    return {
      id,
      kind: "housekeeping",
      title: "Other changes",
      items: [JSON.stringify(c).slice(0, 200)],
    } satisfies HousekeepingCard;
  });
}

function clipPatch(patch: string, maxLines = 36, maxChars = 1800): string {
  const lines = patch.split("\n").slice(0, maxLines).join("\n");
  return lines.length > maxChars ? `${lines.slice(0, maxChars)}\n…` : lines;
}

function attachPatchesFromFiles(
  cards: ReviewCard[],
  files: Array<{ filename: string; patch?: string | null }>
): ReviewCard[] {
  const byFile = new Map(
    files.filter((f) => f.patch).map((f) => [f.filename, f.patch as string])
  );

  return cards.map((card) => {
    if (card.kind !== "decision") return card;

    if (card.patch?.trim()) {
      return { ...card, patch: clipPatch(card.patch.trim(), 40, 2200) };
    }

    const snippets: string[] = [];
    for (const path of card.files.slice(0, 3)) {
      const patch = byFile.get(path);
      if (patch) {
        snippets.push(`--- ${path}\n${clipPatch(patch)}`);
      }
    }
    if (!snippets.length) {
      for (const f of files) {
        if (f.patch) {
          snippets.push(`--- ${f.filename}\n${clipPatch(f.patch)}`);
          break;
        }
      }
    }
    if (!snippets.length) return card;
    return { ...card, patch: snippets.join("\n\n").slice(0, 2800) };
  });
}

async function generateCards(userPayload: string): Promise<ReviewCard[]> {
  let raw = await chatCompletion(CARD_GENERATION_SYSTEM_PROMPT, userPayload, {
    temperature: 0.15,
    maxTokens: 2500,
    timeoutMs: 50_000,
  });

  try {
    return normalizeCards(parseJsonWithRetryPrep(raw));
  } catch (firstErr) {
    const retryUser = `${userPayload}

Previous output was invalid JSON. Return ONLY a valid JSON object with a "cards" array. No markdown fences.
Error: ${firstErr instanceof Error ? firstErr.message : "parse failed"}
Bad output preview: ${stripJsonFences(raw).slice(0, 400)}`;

    raw = await chatCompletion(CARD_GENERATION_SYSTEM_PROMPT, retryUser, {
      temperature: 0.1,
      maxTokens: 2500,
      timeoutMs: 40_000,
    });
    return normalizeCards(parseJsonWithRetryPrep(raw));
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fresh = searchParams.get("fresh") === "1";
    const prNumber = resolvePRNumber(searchParams.get("pr"));
    const coords = resolveRepo({
      owner: searchParams.get("owner"),
      repo: searchParams.get("repo"),
    });
    const key = cacheKey(coords.owner, coords.repo, prNumber);

    if (!fresh) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return NextResponse.json({ ...hit.payload, cached: true });
      }
    }

    const [pr, diff, files] = await Promise.all([
      getPR(prNumber, coords),
      getDiff(prNumber, coords),
      getFiles(prNumber, coords),
    ]);

    const fileList = files
      .map(
        (f) =>
          `${f.status}\t${f.filename}\t+${f.additions}/-${f.deletions}`
      )
      .join("\n");

    // Cap diff size for model context — keep this small for phone-demo latency.
    const diffClipped =
      diff.length > 40_000
        ? `${diff.slice(0, 40_000)}\n\n…[diff truncated]…`
        : diff;

    const userPayload = `PR #${pr.number}: ${pr.title}

Description:
${pr.body || "(no description)"}

Files:
${fileList}

Unified diff:
${diffClipped}`;

    let cards = await generateCards(userPayload);
    cards = attachPatchesFromFiles(cards, files);

    const meta: PRMeta = {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      html_url: pr.html_url,
      user: pr.user?.login ?? null,
      base: pr.base.ref,
      head: pr.head.ref,
      additions: pr.additions,
      deletions: pr.deletions,
      changed_files: pr.changed_files,
      owner: coords.owner,
      repo: coords.repo,
    };

    const payload: PRResponse = { pr: meta, cards, cached: false };
    cache.set(key, { at: Date.now(), payload });

    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load PR review cards";
    const status = err instanceof PRNumberError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
