"use client";

import { useEffect, useRef, useCallback } from "react";
import type { CitationResult, Verdict } from "@/lib/types";

interface ArticlePanelProps {
  html: string;
  title: string;
  verificationResults: Map<number, CitationResult>;
  highlightedCitation: number | null;
}

const verdictColorClass: Record<Verdict, string> = {
  supported: "wikicheck-supported",
  partial: "wikicheck-partial",
  unsupported: "wikicheck-unsupported",
  unverifiable: "wikicheck-unverifiable",
};

export default function ArticlePanel({
  html,
  title,
  verificationResults,
  highlightedCitation,
}: ArticlePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const applyCitationHighlights = useCallback(() => {
    if (!containerRef.current) return;

    // Find all superscript citation links (Wikipedia uses <sup> tags with [1], [2], etc.)
    const supElements = containerRef.current.querySelectorAll("sup.reference");

    supElements.forEach((sup) => {
      const link = sup.querySelector("a");
      if (!link) return;

      // Extract citation number from the text content like "[1]"
      const text = link.textContent || "";
      const numMatch = text.match(/\[(\d+)\]/);
      if (!numMatch) return;

      const num = parseInt(numMatch[1], 10);
      const result = verificationResults.get(num);

      // Reset classes
      sup.className = "reference";

      if (result) {
        sup.classList.add("wikicheck-citation", verdictColorClass[result.verdict]);
      }

      // Handle highlight animation
      if (highlightedCitation === num) {
        sup.classList.add("wikicheck-highlight");
        sup.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [verificationResults, highlightedCitation]);

  useEffect(() => {
    applyCitationHighlights();
  }, [applyCitationHighlights]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-black">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-y-none bg-white px-6 py-4 wikipedia-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
