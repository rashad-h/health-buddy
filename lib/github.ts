import { Octokit } from "@octokit/rest";

export type SafeReviewEvent = "COMMENT" | "REQUEST_CHANGES";

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || "rashad-h";
  const repo = process.env.GITHUB_REPO || "ExpenseTracker";
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }
  return { token, owner, repo };
}

export function getOctokit(): Octokit {
  const { token } = getConfig();
  return new Octokit({ auth: token });
}

export function getRepoCoords() {
  const { owner, repo } = getConfig();
  return { owner, repo };
}

export async function getPR(prNumber: number) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoCoords();
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data;
}

export async function getDiff(prNumber: number): Promise<string> {
  const octokit = getOctokit();
  const { owner, repo } = getRepoCoords();
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
  // Diff media type returns a raw string
  return typeof data === "string" ? data : String(data);
}

export async function getFiles(prNumber: number) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoCoords();
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
}) {
  if (params.event !== "COMMENT" && params.event !== "REQUEST_CHANGES") {
    throw new Error("Unsafe review event blocked — only COMMENT or REQUEST_CHANGES allowed");
  }

  const octokit = getOctokit();
  const { owner, repo } = getRepoCoords();

  const { data } = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: params.prNumber,
    body: params.body,
    event: params.event,
  });

  return data;
}

export function resolvePRNumber(override?: string | null): number {
  if (override) {
    const n = Number(override);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("Invalid PR number");
    }
    return Math.floor(n);
  }
  const fromEnv = process.env.GITHUB_PR_NUMBER;
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  throw new Error("No PR number provided — set GITHUB_PR_NUMBER or pass ?pr=");
}
