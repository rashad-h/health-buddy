"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import MermaidDiagram from "@/components/MermaidDiagram";
import type { ReviewCard, RiskLevel, Verdict } from "@/lib/types";

const SWIPE_THRESHOLD = 110;

function riskColor(risk: RiskLevel): string {
  if (risk === "high") return "text-hold";
  if (risk === "medium") return "text-amber-700";
  return "text-ship";
}

interface SwipeDeckProps {
  cards: ReviewCard[];
  index: number;
  onVerdict: (cardId: string, verdict: Verdict) => void;
  onRejectNeedComment: (cardId: string, title: string) => void;
}

export default function SwipeDeck({
  cards,
  index,
  onVerdict,
  onRejectNeedComment,
}: SwipeDeckProps) {
  const card = cards[index];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const shipOpacity = useTransform(x, [40, 140], [0, 1]);
  const holdOpacity = useTransform(x, [-140, -40], [1, 0]);

  if (!card) return null;

  const title =
    card.kind === "decision"
      ? card.title
      : card.title || "Housekeeping";

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onVerdict(card.id, "approve");
      x.set(0);
      return;
    }
    if (info.offset.x < -SWIPE_THRESHOLD) {
      onRejectNeedComment(card.id, title);
      x.set(0);
      return;
    }
  };

  return (
    <div className="relative w-full flex-1 min-h-[420px] flex items-stretch">
      {/* Stack peek */}
      {cards[index + 1] && (
        <div className="absolute inset-x-3 top-3 bottom-0 rounded-2xl border border-border bg-white/70 scale-[0.97]" />
      )}

      <motion.article
        key={card.id}
        style={{ x, rotate }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        onDragEnd={handleDragEnd}
        className="relative z-10 flex flex-col w-full rounded-2xl border border-border bg-white shadow-[0_12px_40px_rgba(16,19,18,0.08)] overflow-hidden touch-pan-y"
      >
        <motion.div
          style={{ opacity: shipOpacity }}
          className="pointer-events-none absolute top-4 left-4 z-20 rounded-lg bg-ship px-3 py-1 text-sm font-semibold text-white"
        >
          SHIP
        </motion.div>
        <motion.div
          style={{ opacity: holdOpacity }}
          className="pointer-events-none absolute top-4 right-4 z-20 rounded-lg bg-hold px-3 py-1 text-sm font-semibold text-white"
        >
          HOLD
        </motion.div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink/45 font-mono">
            <span>{card.kind}</span>
            <span>·</span>
            <span>
              {index + 1}/{cards.length}
            </span>
          </div>

          <h2 className="font-display text-2xl leading-tight text-ink text-balance">
            {title}
          </h2>

          {card.kind === "decision" ? (
            <>
              <p className="text-sm leading-relaxed text-ink/75">{card.summary}</p>
              <p className="text-sm text-ink/90">
                <span className="font-medium text-accent">Why it matters: </span>
                {card.why_it_matters}
              </p>
              <p className={`text-sm font-medium ${riskColor(card.risk)}`}>
                Risk: {card.risk}
                <span className="font-normal text-ink/60"> — {card.risk_reason}</span>
              </p>
              {card.files.length > 0 && (
                <ul className="text-xs font-mono text-ink/50 space-y-0.5">
                  {card.files.slice(0, 6).map((f) => (
                    <li key={f} className="truncate">
                      {f}
                    </li>
                  ))}
                  {card.files.length > 6 && (
                    <li>+{card.files.length - 6} more</li>
                  )}
                </ul>
              )}
              {card.diagram && <MermaidDiagram chart={card.diagram} />}
              {card.patch && (
                <pre className="text-[10px] leading-snug font-mono bg-ink/[0.04] border border-border rounded-lg p-2 overflow-x-auto max-h-32 text-ink/70">
                  {card.patch}
                </pre>
              )}
            </>
          ) : (
            <ul className="space-y-2">
              {card.items.map((item, i) => (
                <li
                  key={`${card.id}-${i}`}
                  className="text-sm text-ink/75 pl-3 border-l-2 border-border"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 p-4 border-t border-border bg-page/60">
          <button
            type="button"
            onClick={() => onRejectNeedComment(card.id, title)}
            className="h-11 rounded-xl border border-hold/30 text-hold text-sm font-medium"
          >
            Hold
          </button>
          <button
            type="button"
            onClick={() => onVerdict(card.id, "skip")}
            className="h-11 rounded-xl border border-border text-ink/50 text-sm font-medium"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onVerdict(card.id, "approve")}
            className="h-11 rounded-xl bg-ship text-white text-sm font-medium"
          >
            Ship
          </button>
        </div>
      </motion.article>
    </div>
  );
}
