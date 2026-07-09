import { Octokit } from "@octokit/rest";
import type { PullRequestState } from "@/lib/types";

export type SafeReviewEvent = "COMMENT" | "REQUEST_CHANGES";

export class PRNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PRNumberError";
  }
}

export type RepoRef = { owner: string; repo: string };

/** Hardcoded demo catalog — always shown as open in the dashboard. */
export const DEMO_TARGETS: Array<RepoRef & { number: number; label: string }> = [
  {
    owner: "rashad-h",
    repo: "ExpenseTracker",
    number: 1,
    label: "ExpenseTracker",
  },
  {
    owner: "rashad-h",
    repo: "ExpenseTracker",
    number: 2,
    label: "ExpenseTracker",
  },
  {
    owner: "rashad-h",
    repo: "health-buddy",
    number: 3,
    label: "health-buddy",
  },
  {
    owner: "rashad-h",
    repo: "health-buddy",
    number: 4,
    label: "health-buddy",
  },
];

const DEFAULT_REPO: RepoRef = {
  owner: "rashad-h",
  repo: "ExpenseTracker",
};

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }
  return token;
}

export function getOctokit(): Octokit {
  return new Octokit({ auth: getToken() });
}

export function getRepoCoords(): RepoRef {
  return DEFAULT_REPO;
}

export function resolveRepo(params?: {
  owner?: string | null;
  repo?: string | null;
}): RepoRef {
  const owner = params?.owner?.trim() || DEFAULT_REPO.owner;
  const repo = params?.repo?.trim() || DEFAULT_REPO.repo;
  const allowed = DEMO_TARGETS.some((t) => t.owner === owner && t.repo === repo);
  if (!allowed) {
    throw new Error(`Repo ${owner}/${repo} is not in the demo catalog`);
  }
  return { owner, repo };
}

export async function getPR(prNumber: number, coords?: RepoRef) {
  const octokit = getOctokit();
  const { owner, repo } = coords ?? getRepoCoords();
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data;
}

export async function listPulls(params?: {
  state?: PullRequestState;
  perPage?: number;
  coords?: RepoRef;
}) {
  const octokit = getOctokit();
  const { owner, repo } = params?.coords ?? getRepoCoords();
  const state = params?.state ?? "all";
  const perPage = params?.perPage ?? 30;

  if (state === "all") {
    const [open, closed] = await Promise.all([
      octokit.paginate(octokit.pulls.list, {
        owner,
        repo,
        state: "open",
        sort: "updated",
        direction: "desc",
        per_page: perPage,
      }),
      octokit.paginate(octokit.pulls.list, {
        owner,
        repo,
        state: "closed",
        sort: "updated",
        direction: "desc",
        per_page: perPage,
      }),
    ]);
    const byNumber = new Map<number, (typeof open)[number]>();
    for (const pull of [...open, ...closed]) {
      byNumber.set(pull.number, pull);
    }
    return Array.from(byNumber.values())
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
      .slice(0, perPage);
  }

  return octokit.paginate(octokit.pulls.list, {
    owner,
    repo,
    state,
    sort: "updated",
    direction: "desc",
    per_page: perPage,
  });
}

/** Fetch the hardcoded demo PR catalog (both repos). Always mark as open. */
export async function listDemoPulls() {
  const results = await Promise.all(
    DEMO_TARGETS.map(async (target) => {
      try {
        const pull = await getPR(target.number, {
          owner: target.owner,
          repo: target.repo,
        });
        return { target, pull, error: null as string | null };
      } catch (err) {
        return {
          target,
          pull: null,
          error: err instanceof Error ? err.message : "Failed to load PR",
        };
      }
    })
  );
  return results;
}

export async function getDiff(prNumber: number, coords?: RepoRef): Promise<string> {
  const octokit = getOctokit();
  const { owner, repo } = coords ?? getRepoCoords();
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      owner,
      repo,
      pull_number: prNumber,
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
    }
  );
  return typeof data === "string" ? data : String(data);
}

export async function getFiles(prNumber: number, coords?: RepoRef) {
  const octokit = getOctokit();
  const { owner, repo } = coords ?? getRepoCoords();
  const files = await octokit.paginate(octokit.pulls.listFiles, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return files;
}

/**
 * Submit a PR review. SAFETY: only COMMENT or REQUEST_CHANGES.
 * Never APPROVE (which can enable merge), never merge, never push.
 */
export async function createReview(params: {
  prNumber: number;
  body: string;
  event: SafeReviewEvent;
  coords?: RepoRef;
}) {
  if (params.event !== "COMMENT" && params.event !== "REQUEST_CHANGES") {
    throw new Error(
      "Unsafe review event blocked — only COMMENT or REQUEST_CHANGES allowed"
    );
  }

  const octokit = getOctokit();
  const { owner, repo } = params.coords ?? getRepoCoords();

  const safeEvent: SafeReviewEvent =
    params.event === "REQUEST_CHANGES" ? "REQUEST_CHANGES" : "COMMENT";

  const { data } = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: params.prNumber,
    body: params.body,
    event: safeEvent,
  });

  return data;
}

export function resolvePRNumber(override?: string | null): number {
  const requested = override?.trim();
  if (requested) {
    const n = Number(requested);
    if (!Number.isFinite(n) || n <= 0) {
      throw new PRNumberError(
        "Invalid PR number. Pass ?pr=<number> with a positive integer."
      );
    }
    return Math.floor(n);
  }
  const fromEnv = process.env.GITHUB_PR_NUMBER?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) {
      return Math.floor(n);
    }
    throw new PRNumberError(
      "Invalid GITHUB_PR_NUMBER. Pass ?pr=<number> or set GITHUB_PR_NUMBER to a positive integer."
    );
  }
  throw new PRNumberError(
    "No PR number provided. Pass ?pr=<number> or set GITHUB_PR_NUMBER in the environment."
  );
}
