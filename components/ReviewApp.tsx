"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SwipeDeck from "@/components/SwipeDeck";
import VoiceSheet from "@/components/VoiceSheet";
import type {
  CardVerdict,
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

export default function ReviewApp() {
  const [data, setData] = useState<PRResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
    if (!loading) return;
    const t = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_LINES.length);
    }, 1800);
    return () => clearInterval(t);
  }, [loading]);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setVerdicts([]);
    setIndex(0);
    setStatusIdx(0);
    try {
      const qs = fresh ? "?fresh=1" : "";
      const res = await fetch(`/api/pr${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load PR");
      setData(json as PRResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PR");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const done = useMemo(
    () => !!data && data.cards.length > 0 && index >= data.cards.length,
    [data, index]
  );

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resetDeck = () => {
    void load(true);
  };

  const approveCount = verdicts.filter((v) => v.verdict === "approve").length;
  const rejectCount = verdicts.filter((v) => v.verdict === "reject").length;
  const skipCount = verdicts.filter((v) => v.verdict === "skip").length;

  return (
    <div className="min-h-[100dvh] w-full max-w-[420px] mx-auto flex flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="mb-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-3xl tracking-tight text-ink leading-none">
              Swipe-to-Ship
            </p>
            {data && !loading && (
              <p className="mt-1.5 text-sm text-ink/55 truncate">
                #{data.pr.number} · {data.pr.title}
              </p>
            )}
          </div>
          {data && !loading && (
            <button
              type="button"
              onClick={resetDeck}
              className="shrink-0 text-xs font-mono text-ink/40 hover:text-accent pt-1"
              title="Reload cards (?fresh=1)"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      {loading && (
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

      {!loading && error && !data && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-2">
          <p className="text-hold text-sm leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => void load(true)}
            className="h-11 px-5 rounded-xl bg-accent text-white text-sm font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && data && data.cards.length === 0 && !result && (
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

      {!loading && data && data.cards.length > 0 && !done && !result && (
        <SwipeDeck
          cards={data.cards}
          index={index}
          onVerdict={(id, v) => recordVerdict(id, v)}
          onRejectNeedComment={onRejectNeedComment}
        />
      )}

      {!loading && data && done && !result && (
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

      {result && (
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
