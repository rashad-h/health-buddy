import { NextResponse } from "next/server";
import { listDemoPulls } from "@/lib/github";
import type { PRListItem, PRListResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = await listDemoPulls();

    const prs: PRListItem[] = [];
    const errors: string[] = [];

    for (const result of results) {
      if (!result.pull) {
        errors.push(
          `${result.target.owner}/${result.target.repo}#${result.target.number}: ${result.error}`
        );
        continue;
      }

      const pull = result.pull;
      const stats = pull as typeof pull & {
        additions?: number;
        deletions?: number;
        changed_files?: number;
        mergeable_state?: string | null;
      };

      prs.push({
        number: pull.number,
        title: pull.title,
        // Demo UX: always show as open regardless of real GitHub state.
        state: "open",
        draft: false,
        user: pull.user?.login ?? null,
        updated_at: pull.updated_at,
        html_url: pull.html_url,
        additions: stats.additions ?? 0,
        deletions: stats.deletions ?? 0,
        changed_files: stats.changed_files,
        labels: [
          result.target.label,
          ...pull.labels
            .map((label) => label.name)
            .filter((name): name is string => Boolean(name)),
        ],
        mergeable_state: stats.mergeable_state,
        owner: result.target.owner,
        repo: result.target.repo,
      });
    }

    prs.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    if (!prs.length) {
      return NextResponse.json(
        {
          error:
            errors[0] ||
            "No demo PRs could be loaded. Check GITHUB_TOKEN access to ExpenseTracker and health-buddy.",
        },
        { status: 500 }
      );
    }

    const payload: PRListResponse = {
      repo: { owner: "rashad-h", name: "demo-catalog" },
      prs,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list pull requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
