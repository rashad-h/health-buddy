"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SwipeDeck from "@/components/SwipeDeck";
import VoiceSheet from "@/components/VoiceSheet";
import type {
  CardVerdict,
  PRListItem,
  PRListResponse,
  PRResponse,
  ReviewResponse,
  Verdict,
} from "@/lib/types";

const STATUS_LINES = [
  "Pulling the PR…",
  "Reading the diff…",
  "Grouping by intent…",
  "Ranking decisions…",
  "Compressing housekeeping…",
  "Almost ready…",
];

type Screen = "list" | "loading" | "deck" | "done" | "success";

function formatRelativeTime(value: string): string {
  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) return "updated recently";

  const diffMs = Date.now() - updatedAt;
  if (diffMs < 60_000) return "updated just now";

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (diffMs >= ms) {
      return `updated ${formatter.format(-Math.floor(diffMs / ms), unit)}`;
    }
  }

  return "updated just now";
}

function statusLabel(pr: PRListItem): string {
  if (pr.draft) return "Draft";
  return pr.state === "open" ? "Open" : "Closed";
}

function statusClass(pr: PRListItem): string {
  if (pr.draft) return "bg-ink/10 text-ink/60";
  return pr.state === "open"
    ? "bg-ship/10 text-ship"
    : "bg-ink/10 text-ink/50";
}

export default function ReviewApp() {
  const [screen, setScreen] = useState<Screen>("list");
  const [prList, setPrList] = useState<PRListResponse | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedPrNumber, setSelectedPrNumber] = useState<number | null>(null);
  const [data, setData] = useState<PRResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusIdx, setStatusIdx] = useState(0);
  const [index, setIndex] = useState(0);
  const [verdicts, setVerdicts] = useState<CardVerdict[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [pendingReject, setPendingReject] = useState<{
    cardId: string;
    title: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReviewResponse | null>(null);

  useEffect(() => {
    if (screen !== "loading") return;
    const t = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_LINES.length);
    }, 1800);
    return () => clearInterval(t);
  }, [screen]);

  const loadPRList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/prs?state=all");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load PRs");
      setPrList(json as PRListResponse);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load PRs");
      setPrList(null);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPRList();
  }, [loadPRList]);

  const loadReview = useCallback(async (prNumber: number, fresh = false) => {
    setSelectedPrNumber(prNumber);
    setScreen("loading");
    setError(null);
    setResult(null);
    setVerdicts([]);
    setIndex(0);
    setStatusIdx(0);
    setData(null);
    try {
      const params = new URLSearchParams();
      if (fresh) params.set("fresh", "1");
      params.set("pr", String(prNumber));
      const res = await fetch(`/api/pr?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load PR");
      setData(json as PRResponse);
      setScreen("deck");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PR");
      setData(null);
      setScreen("deck");
    }
  }, []);

  const selectPR = useCallback(
    (prNumber: number) => {
      void loadReview(prNumber);
    },
    [loadReview]
  );

  useEffect(() => {
    if (
      screen === "deck" &&
      data &&
      data.cards.length > 0 &&
      index >= data.cards.length
    ) {
      setScreen("done");
    }
  }, [data, index, screen]);

  const recordVerdict = (cardId: string, verdict: Verdict, comment?: string) => {
    setVerdicts((prev) => {
      const next = prev.filter((v) => v.cardId !== cardId);
      next.push({ cardId, verdict, comment });
      return next;
    });
    setIndex((i) => i + 1);
  };

  const onRejectNeedComment = (cardId: string, title: string) => {
    setPendingReject({ cardId, title });
    setVoiceOpen(true);
  };

  const onVoiceSubmit = (comment: string) => {
    if (!pendingReject) return;
    recordVerdict(pendingReject.cardId, "reject", comment);
    setPendingReject(null);
  };

  const closeVoiceWithoutVerdict = () => {
    setVoiceOpen(false);
    setPendingReject(null);
  };

  const submitReview = async () => {
    if (!data) return;
    setSubmitting(true);
    setError(null);
    try {
      const enriched = verdicts.map((v) => {
        const card = data.cards.find((c) => c.id === v.cardId);
        const label =
          card?.kind === "decision"
            ? card.title
            : card?.kind === "housekeeping"
              ? card.title || "Housekeeping"
              : v.cardId;
        return { ...v, cardId: label };
      });

      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prNumber: data.pr.number,
          verdicts: enriched,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Submit failed");
      setResult(json as ReviewResponse);
      setScreen("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resetDeck = () => {
    const prNumber = selectedPrNumber ?? data?.pr.number;
    if (!prNumber) return;
    void loadReview(prNumber, true);
  };

  const backToList = () => {
    setScreen("list");
    setSelectedPrNumber(null);
    setData(null);
    setError(null);
    setResult(null);
    setVerdicts([]);
    setIndex(0);
    setVoiceOpen(false);
    setPendingReject(null);
  };

  const approveCount = verdicts.filter((v) => v.verdict === "approve").length;
  const rejectCount = verdicts.filter((v) => v.verdict === "reject").length;
  const skipCount = verdicts.filter((v) => v.verdict === "skip").length;
  const selectedListItem = useMemo(
    () => prList?.prs.find((pr) => pr.number === selectedPrNumber),
    [prList, selectedPrNumber]
  );
  const repoName = prList ? `${prList.repo.owner}/${prList.repo.name}` : "";
  const inReview = screen !== "list";

  return (
    <div className="min-h-[100dvh] w-full max-w-[420px] mx-auto flex flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="mb-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {inReview && (
              <button
                type="button"
                onClick={backToList}
                className="mb-2 -ml-1 text-xs font-mono text-ink/45 hover:text-accent"
              >
                ← PRs
              </button>
            )}
            <p className="font-display text-3xl tracking-tight text-ink leading-none">
              Swipe-to-Ship
            </p>
            {screen === "list" && (
              <p className="mt-1.5 text-sm text-ink/55 truncate">
                {repoName || "Choose a pull request"}
              </p>
            )}
            {inReview && (
              <p className="mt-1.5 text-sm text-ink/55 truncate">
                {data
                  ? `#${data.pr.number} · ${data.pr.title}`
                  : selectedListItem
                    ? `#${selectedListItem.number} · ${selectedListItem.title}`
                    : selectedPrNumber
                      ? `#${selectedPrNumber}`
                      : "Loading selected PR"}
              </p>
            )}
          </div>
          {screen === "list" && prList && !listLoading && (
            <button
              type="button"
              onClick={() => void loadPRList()}
              className="shrink-0 text-xs font-mono text-ink/40 hover:text-accent pt-1"
            >
              Refresh
            </button>
          )}
          {inReview && data && screen !== "loading" && (
            <button
              type="button"
              onClick={resetDeck}
              className="shrink-0 text-xs font-mono text-ink/40 hover:text-accent pt-1"
              title="Reload cards (?fresh=1&pr=N)"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      {screen === "list" && (
        <main className="flex-1 flex flex-col">
          {listLoading && (
            <div className="space-y-3 pt-4">
              <div className="h-16 w-full rounded-2xl shimmer" />
              <div className="h-16 w-full rounded-2xl shimmer" />
              <div className="h-16 w-full rounded-2xl shimmer" />
              <p className="text-sm text-ink/55 text-center pt-3">
                Loading pull requests…
              </p>
            </div>
          )}

          {!listLoading && listError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-2">
              <p className="text-hold text-sm leading-relaxed">{listError}</p>
              <button
                type="button"
                onClick={() => void loadPRList()}
                className="h-11 px-5 rounded-xl bg-accent text-white text-sm font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {!listLoading && !listError && prList?.prs.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-2">
              <p className="font-display text-2xl text-ink">
                No pull requests found
              </p>
              <p className="text-sm text-ink/55">
                New PRs in {repoName} will appear here.
              </p>
            </div>
          )}

          {!listLoading && !listError && prList && prList.prs.length > 0 && (
            <ul className="space-y-3 overflow-y-auto pb-4">
              {prList.prs.map((pr) => (
                <li key={pr.number}>
                  <button
                    type="button"
                    onClick={() => selectPR(pr.number)}
                    className="w-full rounded-2xl border border-border bg-page/80 px-4 py-3 text-left shadow-sm transition active:scale-[0.99] hover:border-accent/30"
                    aria-label={`Review pull request ${pr.number}: ${pr.title}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium leading-snug text-ink">
                        <span className="font-mono text-ink/45">
                          #{pr.number}
                        </span>{" "}
                        · {pr.title}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-mono ${statusClass(
                          pr
                        )}`}
                      >
                        {statusLabel(pr)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/45">
                      <span>{pr.user ? `@${pr.user}` : "unknown author"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(pr.updated_at)}</span>
                      {(pr.additions > 0 ||
                        pr.deletions > 0 ||
                        pr.changed_files) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            +{pr.additions}/-{pr.deletions}
                            {pr.changed_files
                              ? ` in ${pr.changed_files} files`
                              : ""}
                          </span>
                        </>
                      )}
                    </div>
                    {pr.labels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pr.labels.slice(0, 3).map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/45"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </main>
      )}

      {screen === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="w-full space-y-3">
            <div className="h-3 w-2/3 rounded shimmer" />
            <div className="h-40 w-full rounded-2xl shimmer" />
            <div className="h-3 w-full rounded shimmer" />
            <div className="h-3 w-5/6 rounded shimmer" />
            <div className="h-3 w-4/6 rounded shimmer" />
          </div>
          <p
            key={statusIdx}
            className="text-sm text-ink/60 animate-fade-in text-center"
          >
            {STATUS_LINES[statusIdx]}
          </p>
        </div>
      )}

      {screen !== "list" && screen !== "loading" && error && !data && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-2">
          <p className="text-hold text-sm leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={resetDeck}
            className="h-11 px-5 rounded-xl bg-accent text-white text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {screen === "deck" && data && data.cards.length === 0 && !result && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-ink/60">No review cards generated.</p>
          <button
            type="button"
            onClick={resetDeck}
            className="h-11 px-5 rounded-xl bg-accent text-white text-sm font-medium"
          >
            Reset deck
          </button>
        </div>
      )}

      {screen === "deck" && data && data.cards.length > 0 && !result && (
        <SwipeDeck
          cards={data.cards}
          index={index}
          onVerdict={(id, v) => recordVerdict(id, v)}
          onRejectNeedComment={onRejectNeedComment}
        />
      )}

      {screen === "done" && data && !result && (
        <div className="flex-1 flex flex-col justify-center gap-5 animate-fade-in">
          <div>
            <h2 className="font-display text-2xl text-ink">Ready to post</h2>
            <p className="mt-2 text-sm text-ink/60">
              {approveCount} ship · {rejectCount} hold · {skipCount} skip
            </p>
            <p className="mt-2 text-xs text-ink/45 leading-relaxed">
              {rejectCount > 0
                ? "Will request changes (never merges)."
                : "Will leave a comment review (never APPROVE)."}
            </p>
          </div>

          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {verdicts.map((v) => {
              const card = data.cards.find((c) => c.id === v.cardId);
              const label =
                card?.kind === "decision"
                  ? card.title
                  : card?.title || v.cardId;
              const tone =
                v.verdict === "approve"
                  ? "text-ship"
                  : v.verdict === "reject"
                    ? "text-hold"
                    : "text-ink/40";
              return (
                <li
                  key={v.cardId}
                  className="text-sm flex gap-2 border-b border-border pb-2"
                >
                  <span className={`font-mono shrink-0 ${tone}`}>
                    {v.verdict === "approve"
                      ? "✓"
                      : v.verdict === "reject"
                        ? "✕"
                        : "–"}
                  </span>
                  <span className="text-ink/80 min-w-0">
                    <span className="line-clamp-1">{label}</span>
                    {v.comment && (
                      <span className="block text-xs text-ink/50 mt-0.5 line-clamp-2">
                        {v.comment}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          {error && <p className="text-sm text-hold">{error}</p>}
          <button
            type="button"
            disabled={submitting || verdicts.length === 0}
            onClick={() => void submitReview()}
            className="h-12 rounded-xl bg-ink text-page font-medium disabled:opacity-40"
          >
            {submitting ? "Posting review…" : "Submit review"}
          </button>
          <button
            type="button"
            onClick={resetDeck}
            className="text-sm text-ink/50"
          >
            Reset deck
          </button>
        </div>
      )}

      {screen === "success" && result && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center animate-fade-in">
          <p className="font-display text-2xl text-ship">Review posted</p>
          <p className="text-sm text-ink/60">
            Event: <span className="font-mono text-ink">{result.event}</span>
          </p>
          <a
            href={result.html_url || data?.pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 px-6 inline-flex items-center rounded-xl bg-accent text-white text-sm font-medium"
          >
            View on GitHub
          </a>
          <button
            type="button"
            onClick={resetDeck}
            className="text-sm text-ink/50"
          >
            Reset deck
          </button>
        </div>
      )}

      <VoiceSheet
        open={voiceOpen}
        cardTitle={pendingReject?.title || ""}
        onClose={closeVoiceWithoutVerdict}
        onSubmit={onVoiceSubmit}
      />
    </div>
  );
}
