"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * LLM Mermaid often breaks on (), {}, :, and bare special chars in labels.
 * Normalize to quoted labels / plain message text so render is reliable on phone.
 */
export function sanitizeMermaid(raw: string): string | null {
  let chart = raw.trim();
  if (!chart) return null;

  chart = chart.replace(/^```(?:mermaid)?\s*/i, "").replace(/\s*```$/i, "");
  chart = chart.replace(/\r\n/g, "\n").trim();
  if (!chart) return null;

  const first = chart.split("\n")[0]?.trim().toLowerCase() ?? "";
  if (
    !first.startsWith("graph ") &&
    !first.startsWith("flowchart ") &&
    !first.startsWith("sequencediagram")
  ) {
    return null;
  }

  // Quote node labels: A[foo (bar)] / A{foo} / A(foo) → A["foo bar"]
  chart = chart.replace(
    /\b([A-Za-z][\w]*)\s*[\[\(\{]([^\]\)\}]*)[\]\)\}]/g,
    (_m, id: string, label: string) => {
      const clean = String(label)
        .replace(/["']/g, "")
        .replace(/[(){}<>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40);
      return `${id}["${clean || id}"]`;
    }
  );

  if (first.startsWith("sequencediagram")) {
    chart = chart
      .split("\n")
      .map((line) => {
        if (!/(-->>?|->|->>)/.test(line)) return line;
        const idx = line.indexOf(":");
        if (idx === -1) return line;
        const head = line.slice(0, idx);
        const msg = line
          .slice(idx + 1)
          .replace(/[(){}<>]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 48);
        return `${head}: ${msg}`;
      })
      .join("\n");
  }

  chart = chart.replace(/-->\|([^|]+)\|/g, (_m, label: string) => {
    const clean = String(label)
      .replace(/["']/g, "")
      .replace(/[(){}<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 36);
    return `-->|"${clean}"|`;
  });

  return chart;
}

function scrubMermaidErrorNodes(renderId: string) {
  if (typeof document === "undefined") return;
  document.querySelectorAll("body > svg, #dmermaid-svg, [id^='d']").forEach((el) => {
    const text = el.textContent || "";
    if (
      (text.includes("Syntax error") && text.includes("mermaid")) ||
      el.id === renderId ||
      el.id === `d${renderId}`
    ) {
      if (text.includes("Syntax error") || el.id.includes(renderId)) {
        if (text.includes("Syntax error") || text.includes("mermaid version")) {
          el.remove();
        }
      }
    }
  });
  document.querySelectorAll("svg").forEach((svg) => {
    const text = svg.textContent || "";
    if (text.includes("Syntax error") && text.includes("mermaid version")) {
      svg.remove();
    }
  });
}

export default function MermaidDiagram({
  chart,
  onStatus,
}: {
  chart: string;
  onStatus?: (ok: boolean) => void;
}) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const renderId = `mmd${reactId}${Math.random().toString(36).slice(2, 8)}`;

    async function render() {
      const cleaned = sanitizeMermaid(chart);
      if (!cleaned || !containerRef.current) {
        setOk(false);
        onStatus?.(false);
        return;
      }

      containerRef.current.innerHTML = "";
      setOk(false);
      onStatus?.(false);

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          suppressErrorRendering: true,
          theme: "base",
          fontFamily: "Inter, sans-serif",
          themeVariables: {
            primaryColor: "#E8F3EF",
            primaryTextColor: "#101312",
            primaryBorderColor: "#0E5B4A",
            lineColor: "#0E5B4A",
            secondaryColor: "#FAFAF7",
            tertiaryColor: "#FFFFFF",
            background: "#FAFAF7",
            mainBkg: "#E8F3EF",
            nodeBorder: "#0E5B4A",
            clusterBkg: "#FAFAF7",
            titleColor: "#101312",
            edgeLabelBackground: "#FAFAF7",
          },
        });

        await mermaid.parse(cleaned);
        const { svg } = await mermaid.render(renderId, cleaned);
        if (cancelled || !containerRef.current) return;

        if (!svg || svg.includes("Syntax error")) {
          containerRef.current.innerHTML = "";
          setOk(false);
          onStatus?.(false);
          scrubMermaidErrorNodes(renderId);
          return;
        }

        containerRef.current.innerHTML = svg;
        setOk(true);
        onStatus?.(true);
      } catch {
        if (!cancelled) {
          if (containerRef.current) containerRef.current.innerHTML = "";
          setOk(false);
          onStatus?.(false);
          scrubMermaidErrorNodes(renderId);
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
      scrubMermaidErrorNodes(renderId);
    };
  }, [chart, reactId, onStatus]);

  return (
    <div
      ref={containerRef}
      className={
        ok
          ? "overflow-x-auto rounded-lg bg-page/80 border border-border p-2 [&_svg]:max-w-full"
          : "hidden"
      }
      aria-hidden={!ok}
    />
  );
}
