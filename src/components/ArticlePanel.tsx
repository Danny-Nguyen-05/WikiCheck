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

    // ── CLEANUP: unwrap previous sentence-highlight spans ──────────────────────
    containerRef.current
      .querySelectorAll("span.wikicheck-sentence-highlight")
      .forEach((span) => {
        const parent = span.parentNode;
        if (parent) {
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          parent.removeChild(span);
        }
      });
    // Also remove fallback paragraph-level highlight classes
    containerRef.current
      .querySelectorAll(
        "p.wikicheck-sentence-highlight, li.wikicheck-sentence-highlight, dd.wikicheck-sentence-highlight"
      )
      .forEach((el) =>
        el.classList.remove(
          "wikicheck-sentence-highlight",
          "bg-blue-50",
          "border-l-4",
          "border-blue-400",
          "pl-2"
        )
      );

    // Remove previous scroll-target glow on sups
    containerRef.current
      .querySelectorAll(".wikicheck-highlight")
      .forEach((el) => el.classList.remove("wikicheck-highlight"));

    // ── COLOR all citation superscripts by verdict ─────────────────────────────
    const supElements = containerRef.current.querySelectorAll("sup.reference");
    supElements.forEach((sup) => {
      const link = sup.querySelector("a");
      if (!link) return;
      const numMatch = (link.textContent || "").match(/(\d+)/);
      if (!numMatch) return;
      const num = parseInt(numMatch[1], 10);
      const result = verificationResults.get(num);
      sup.className = "reference";
      if (result) sup.classList.add("wikicheck-citation", verdictColorClass[result.verdict]);
    });

    if (highlightedCitation === null) return;

    // ── Find the best-matching occurrence of this citation number ──────────────
    // Wikipedia reuses citation numbers many times. Score each occurrence by
    // counting claim words in its containing paragraph → pick the best match.
    const result = verificationResults.get(highlightedCitation);
    const claim = result?.claim ?? "";
    const claimWords = claim.toLowerCase().split(/\W+/).filter((w) => w.length > 3);

    const allMatchingSups = Array.from(supElements).filter((sup) => {
      const link = sup.querySelector("a");
      const numMatch = (link?.textContent || "").match(/(\d+)/);
      return numMatch && parseInt(numMatch[1], 10) === highlightedCitation;
    });

    if (allMatchingSups.length === 0) return;

    let bestSup = allMatchingSups[0];
    let bestScore = -1;
    for (const sup of allMatchingSups) {
      const block = sup.closest("p, li, td, dd");
      if (!block) continue;
      const blockText = (block.textContent ?? "").toLowerCase();
      const score = claimWords.reduce(
        (acc, w) => acc + (blockText.includes(w) ? 1 : 0),
        0
      );
      if (score > bestScore) {
        bestScore = score;
        bestSup = sup;
      }
    }

    // Scroll to the best matching sup
    bestSup.classList.add("wikicheck-highlight");
    bestSup.scrollIntoView({ behavior: "smooth", block: "center" });

    // ── Find the exact sentence that ends at bestSup ──────────────────────────
    const para = bestSup.closest("p, li, dd");
    if (!para) return;

    // Walk DOM tree collecting TEXT NODES that appear before bestSup.
    // Returns false as soon as bestSup is encountered, stopping the walk.
    // IMPORTANT: skip intermediate <sup class="reference"> elements (other
    // than bestSup itself) — their text content like "[22]" would corrupt cumText
    // and break sentence-boundary detection by turning "Pavia. While" into
    // "Pavia.[22] While", making ". " impossible to find in the right place.
    const textNodesBefore: Text[] = [];
    const collectBefore = (node: Node): boolean => {
      if (node === bestSup) return false;
      // Skip other citation sups — don't recurse into them
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).tagName === "SUP" &&
        (node as Element).classList.contains("reference")
      ) {
        return true; // skip this sup's subtree but continue with siblings
      }
      if (node.nodeType === Node.TEXT_NODE) {
        textNodesBefore.push(node as Text);
        return true;
      }
      for (const child of Array.from(node.childNodes)) {
        if (!collectBefore(child)) return false;
      }
      return true;
    };
    collectBefore(para);


    // Build cumulative raw text from those nodes
    let cumText = "";
    const positions: { node: Text; start: number }[] = [];
    for (const tn of textNodesBefore) {
      positions.push({ node: tn, start: cumText.length });
      cumText += tn.textContent ?? "";
    }

    // Find the start of the current sentence: character AFTER the last `. ` / `! ` / `? `
    const lastBoundary = Math.max(
      cumText.lastIndexOf(". "),
      cumText.lastIndexOf("! "),
      cumText.lastIndexOf("? ")
    );
    const sentenceCharStart = lastBoundary >= 0 ? lastBoundary + 2 : 0;

    // Locate which text node contains sentenceCharStart and compute the offset within it
    let startNode: Text | null = null;
    let startOffset = 0;
    for (const pos of positions) {
      const nodeLen = pos.node.textContent?.length ?? 0;
      const nodeEnd = pos.start + nodeLen;
      if (pos.start <= sentenceCharStart && nodeEnd > sentenceCharStart) {
        startNode = pos.node;
        startOffset = sentenceCharStart - pos.start;
        break;
      }
      if (pos.start === sentenceCharStart) {
        startNode = pos.node;
        startOffset = 0;
        break;
      }
    }
    // Fallback to start of first text node if boundary is before all nodes
    if (!startNode && positions.length > 0) {
      startNode = positions[0].node;
      startOffset = 0;
    }
    if (!startNode) return;

    try {
      // Create a Range from the sentence start to just before the <sup>
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEndBefore(bestSup);

      // Extract and re-insert wrapped in a highlight <span>.
      // extractContents handles ranges that cross element boundaries (e.g. <a> links)
      // correctly — unlike surroundContents which would throw in that case.
      const fragment = range.extractContents();
      const span = document.createElement("span");
      span.className =
        "wikicheck-sentence-highlight bg-blue-100 text-blue-900 rounded px-0.5 transition-all duration-300";
      span.appendChild(fragment);
      range.insertNode(span);
    } catch {
      // Rare fallback if Range is still invalid: highlight the whole paragraph
      para.classList.add(
        "wikicheck-sentence-highlight",
        "bg-blue-50",
        "border-l-4",
        "border-blue-400",
        "pl-2"
      );
    }
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
