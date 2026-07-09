"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function MermaidDiagram({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!chart.trim() || !containerRef.current) return;
      setError(null);
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Inter, sans-serif",
        });
        const { svg } = await mermaid.render(`mmd-${id}`, chart);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Diagram failed");
          if (containerRef.current) containerRef.current.innerHTML = "";
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <p className="text-xs text-ink/50 font-mono truncate" title={error}>
        Diagram unavailable
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto rounded-lg bg-page/80 border border-border p-2 [&_svg]:max-w-full"
    />
  );
}
