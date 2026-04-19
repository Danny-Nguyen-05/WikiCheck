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

    // Remove previous sentence highlights cleanly
    const oldSpans = containerRef.current.querySelectorAll('.wikicheck-sentence-highlight');
    oldSpans.forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      }
    });

    // Find all superscript citation links (Wikipedia uses <sup> tags with [1], [2], etc.)
    const supElements = containerRef.current.querySelectorAll("sup.reference");

    supElements.forEach((sup) => {
      const link = sup.querySelector("a");
      if (!link) return;

      // Extract citation number from the text content like "[1]" or "[note 1]"
      const text = link.textContent || "";
      const numMatch = text.match(/(\d+)/);
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

        // Highlight the preceding sentence nodes
        const nodesToWrap: Node[] = [];
        let current = sup.previousSibling;
        let charCount = 0;

        while (current) {
          // Stop immediately if we hit a block element boundary
          if (current.nodeType === Node.ELEMENT_NODE) {
            const tag = (current as HTMLElement).tagName;
            if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'TABLE', 'TR', 'TD', 'TH', 'UL', 'OL'].includes(tag)) {
              break;
            }
          }

          nodesToWrap.unshift(current);
          
          const nodeText = current.textContent || '';
          charCount += nodeText.length;

          // Stop if we gathered enough text and encounter a punctuation boundary inside this node
          if (charCount > 15 && /[.!?](?:\s|$)/.test(nodeText)) {
            break;
          }

          current = current.previousSibling;
        }

        // Wrap the collected inline nodes
        if (nodesToWrap.length > 0) {
          const wrapper = document.createElement("span");
          // Add noticeable Apple-style focus background
          wrapper.className = "wikicheck-sentence-highlight bg-blue-100 text-blue-900 rounded px-1 transition-all duration-300 shadow-sm";
          
          const parent = nodesToWrap[0].parentNode;
          if (parent) {
            parent.insertBefore(wrapper, nodesToWrap[0]);
            nodesToWrap.forEach(node => wrapper.appendChild(node));
          }
        }
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
