"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";
import MermaidDiagram from "@/components/MermaidDiagram";
import type { ReviewCard, RiskLevel, Verdict } from "@/lib/types";

const SWIPE_DISTANCE = 100;
const SWIPE_VELOCITY = 650;
const EXIT_X = 480;

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
  const reduceMotion = useReducedMotion();
  const rotate = useTransform(
    x,
    [-220, 0, 220],
    reduceMotion ? [0, 0, 0] : [-10, 0, 10]
  );
  const shipOpacity = useTransform(x, [28, 110], [0, 1]);
  const holdOpacity = useTransform(x, [-110, -28], [1, 0]);
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    setShowCode(false);
    setBusy(false);
    busyRef.current = false;
    x.set(0);
  }, [index, x]);

  if (!card) return null;

  const title =
    card.kind === "decision" ? card.title : card.title || "Housekeeping";

  const haptic = () => {
    try {
      navigator.vibrate?.(8);
    } catch {
      /* ignore */
    }
  };

  const flyOff = async (direction: 1 | -1, after: () => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    haptic();

    const target = direction * (typeof window !== "undefined" ? window.innerWidth * 1.15 : EXIT_X);
    await animate(x, target, {
      type: "spring",
      stiffness: reduceMotion ? 500 : 280,
      damping: reduceMotion ? 40 : 28,
      mass: 0.85,
      velocity: direction * 1200,
    }).finished;

    after();
  };

  const snapBack = () => {
    void animate(x, 0, {
      type: "spring",
      stiffness: 420,
      damping: 32,
      mass: 0.7,
    });
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (busyRef.current) return;

    const traveled = info.offset.x;
    const flicked = info.velocity.x;
    const goRight =
      traveled > SWIPE_DISTANCE || flicked > SWIPE_VELOCITY;
    const goLeft =
      traveled < -SWIPE_DISTANCE || flicked < -SWIPE_VELOCITY;

    if (goRight) {
      void flyOff(1, () => onVerdict(card.id, "approve"));
      return;
    }
    if (goLeft) {
      void flyOff(-1, () => {
        x.set(0);
        busyRef.current = false;
        setBusy(false);
        onRejectNeedComment(card.id, title);
      });
      return;
    }
    snapBack();
  };

  const onHold = () => {
    if (busyRef.current) return;
    void flyOff(-1, () => {
      x.set(0);
      busyRef.current = false;
      setBusy(false);
      onRejectNeedComment(card.id, title);
    });
  };

  const onShip = () => {
    if (busyRef.current) return;
    void flyOff(1, () => onVerdict(card.id, "approve"));
  };

  const onSkip = () => {
    if (busyRef.current) return;
    void flyOff(1, () => onVerdict(card.id, "skip"));
  };

  return (
    <div className="relative w-full flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-center gap-1.5 py-1" aria-label="Progress">
        {cards.map((c, i) => (
          <span
            key={c.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index
                ? "w-5 bg-accent"
                : i < index
                  ? "w-1.5 bg-accent/40"
                  : "w-1.5 bg-border"
            }`}
          />
        ))}
      </div>

      <div className="relative flex-1 min-h-[380px] flex items-stretch">
        {cards[index + 1] && (
          <div
            aria-hidden
            className="absolute inset-x-3 top-3 bottom-0 rounded-2xl border border-border bg-white/80 scale-[0.96] shadow-[0_4px_16px_rgba(16,19,18,0.04)]"
          />
        )}

        <motion.article
          key={card.id}
          style={{
            x,
            rotate,
            willChange: "transform",
            touchAction: "pan-y",
          }}
          drag={busy ? false : "x"}
          dragDirectionLock
          dragMomentum={false}
          dragElastic={0.18}
          dragConstraints={{ left: 0, right: 0 }}
          dragTransition={{
            bounceStiffness: 380,
            bounceDamping: 28,
            power: 0.2,
            timeConstant: 180,
          }}
          onDragEnd={handleDragEnd}
          className="relative z-10 flex flex-col w-full rounded-2xl border border-border bg-white shadow-[0_12px_40px_rgba(16,19,18,0.08)] overflow-hidden select-none"
        >
          <motion.div
            style={{ opacity: shipOpacity }}
            className="pointer-events-none absolute top-5 left-5 z-20 -rotate-12 rounded border-2 border-ship px-3 py-1 font-display text-lg font-bold tracking-widest text-ship bg-ship/10"
          >
            SHIP
          </motion.div>
          <motion.div
            style={{ opacity: holdOpacity }}
            className="pointer-events-none absolute top-5 right-5 z-20 rotate-12 rounded border-2 border-hold px-3 py-1 font-display text-lg font-bold tracking-widest text-hold bg-hold/10"
          >
            HOLD
          </motion.div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 overscroll-contain">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink/45 font-mono">
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

                {card.code_snippet && (
                  <div className="rounded-xl border border-accent/20 bg-ink/[0.03] overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-border/80 text-[10px] uppercase tracking-wider font-mono text-accent/80">
                      Key change
                    </div>
                    <pre className="px-3 py-2 text-[11px] leading-relaxed font-mono text-ink/85 whitespace-pre-wrap break-words">
                      {card.code_snippet}
                    </pre>
                  </div>
                )}

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
                    {card.files.length > 6 && <li>+{card.files.length - 6} more</li>}
                  </ul>
                )}
                {card.diagram ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-mono text-ink/45">
                      Flow
                    </p>
                    <MermaidDiagram chart={card.diagram} />
                  </div>
                ) : null}
                {card.patch && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowCode((v) => !v)}
                      className="text-xs font-mono text-accent underline-offset-2 hover:underline"
                    >
                      {showCode ? "Hide code" : "Show code"}
                    </button>
                    {showCode && (
                      <pre className="mt-2 text-[10px] leading-snug font-mono bg-ink/[0.04] border border-border rounded-lg p-2 overflow-x-auto max-h-40 text-ink/70">
                        {card.patch}
                      </pre>
                    )}
                  </div>
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
              aria-label="Hold"
              disabled={busy}
              onClick={onHold}
              className="h-12 rounded-xl border border-hold/30 text-hold text-xl font-semibold active:scale-95 transition-transform disabled:opacity-40"
            >
              ✕
            </button>
            <button
              type="button"
              aria-label="Skip"
              disabled={busy}
              onClick={onSkip}
              className="h-12 rounded-xl border border-border text-ink/45 text-sm font-medium active:scale-95 transition-transform disabled:opacity-40"
            >
              Skip
            </button>
            <button
              type="button"
              aria-label="Ship"
              disabled={busy}
              onClick={onShip}
              className="h-12 rounded-xl bg-ship text-white text-xl font-semibold active:scale-95 transition-transform disabled:opacity-40"
            >
              ✓
            </button>
          </div>
        </motion.article>
      </div>
    </div>
  );
}
