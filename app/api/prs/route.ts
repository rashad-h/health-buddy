import { NextRequest, NextResponse } from "next/server";
import { getRepoCoords, listPulls } from "@/lib/github";
import type {
  PRListItem,
  PRListResponse,
  PullRequestState,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_STATES = new Set<PullRequestState>(["open", "closed", "all"]);
const DEFAULT_LIMIT = 30;

function parseState(value: string | null): PullRequestState {
  if (!value) return "all";
  if (VALID_STATES.has(value as PullRequestState)) {
    return value as PullRequestState;
  }
  throw new Error("Invalid state. Use open, closed, or all.");
}

function normalizePull(pull: Awaited<ReturnType<typeof listPulls>>[number]): PRListItem {
  const stats = pull as typeof pull & {
    additions?: number;
    deletions?: number;
    changed_files?: number;
    mergeable_state?: string | null;
  };

  return {
    number: pull.number,
    title: pull.title,
    state: pull.state === "closed" ? "closed" : "open",
    draft: Boolean(pull.draft),
    user: pull.user?.login ?? null,
    updated_at: pull.updated_at,
    html_url: pull.html_url,
    additions: stats.additions ?? 0,
    deletions: stats.deletions ?? 0,
    changed_files: stats.changed_files,
    labels: pull.labels
      .map((label) => label.name)
      .filter((name): name is string => Boolean(name)),
    mergeable_state: stats.mergeable_state,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const state = parseState(searchParams.get("state"));
    const pulls = await listPulls({ state, perPage: DEFAULT_LIMIT });
    const { owner, repo } = getRepoCoords();

    const prs = pulls.map(normalizePull);
    if (state === "all") {
      prs.sort((a, b) => {
        if (a.state !== b.state) return a.state === "open" ? -1 : 1;
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
    }

    const payload: PRListResponse = {
      repo: { owner, name: repo },
      prs,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list pull requests";
    const status = message.startsWith("Invalid state") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
