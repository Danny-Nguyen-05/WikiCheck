"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CitationResult, Verdict } from "@/lib/types";

interface ArticlePanelProps {
  html: string;
  title: string;
  verificationResults: Map<number, CitationResult>;
  highlightedCitation: number | null;
  /** Maps citation number → sourceSentence for direct text search.
   *  Built from the parsed citations array in the parent page. */
  sourceSentences?: Map<number, string>;
}

const verdictColorClass: Record<Verdict, string> = {
  supported: "wikicheck-supported",
  partial: "wikicheck-partial",
  unsupported: "wikicheck-unsupported",
  unverifiable: "wikicheck-unverifiable",
};

const wikiArticleNamespaces = new Set([
  "File",
  "Category",
  "Help",
  "Special",
  "Template",
  "Talk",
  "User",
  "Wikipedia",
  "Portal",
  "Draft",
  "Module",
  "MediaWiki",
  "TimedText",
]);

function getWikiArticleTitle(href: string): string | null {
  let pathname = href;

  try {
    const url = href.startsWith("http") ? new URL(href) : null;
    if (url) {
      if (!url.hostname.endsWith("wikipedia.org")) return null;
      pathname = url.pathname;
    }
  } catch {
    return null;
  }

  if (!pathname.startsWith("/wiki/")) return null;

  const encodedTitle = pathname.slice("/wiki/".length);
  if (!encodedTitle) return null;

  const title = decodeURIComponent(encodedTitle).replace(/_/g, " ");
  const namespace = title.split(":", 1)[0];

  return wikiArticleNamespaces.has(namespace) ? null : title;
}

export default function ArticlePanel({
  html,
  title,
  verificationResults,
  highlightedCitation,
  sourceSentences,
}: ArticlePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
    // Use sourceSentence for word scoring — CitationResult doesn't carry claim text.
    // sourceSentence has the full sentence context which is better for scoring anyway.
    const scoringText = sourceSentences?.get(highlightedCitation) ?? "";
    const claimWords = scoringText.toLowerCase().split(/\W+/).filter((w) => w.length > 3);


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

    // ── Determine sentence start ──────────────────────────────────────────────
    // Strategy 1: direct text search using sourceSentence stored at parse time.
    // Take the first 60 chars as the search key (long enough to be unique,
    // short enough to avoid encoding edge cases mid-sentence).
    let sentenceCharStart = 0;
    let foundViaSearch = false;

    const sourceSentence = sourceSentences?.get(highlightedCitation);
    if (sourceSentence && sourceSentence.length >= 10) {
      // Normalize both strings identically, using ONLY 1:1 character replacements
      // (no \s+ collapsing, no .trim()) so that idx in the normalized string is the
      // EXACT same character position in the original cumText.
      const normalize = (s: string) =>
        s.toLowerCase()
          .replace(/[\u2013\u2014]/g, "-")  // en/em-dash → hyphen
          .replace(/[\u2018\u2019]/g, "'")  // curly single quotes
          .replace(/[\u201c\u201d]/g, '"')  // curly double quotes
          .replace(/\u00a0/g, " ");         // non-breaking space → space

      const normCumText = normalize(cumText);
      const searchKey = normalize(sourceSentence).slice(0, 60).trim();

      if (searchKey.length >= 10) {
        const idx = normCumText.indexOf(searchKey);
        if (idx !== -1) {
          // Since normalize uses only 1:1 char replacements, idx in the
          // normalized string = exact character position in original cumText.
          sentenceCharStart = idx;
          foundViaSearch = true;
        }
      }
    }

    // Strategy 2 (fallback): find last sentence-ending punctuation before the sup.
    if (!foundViaSearch) {
      const lastBoundary = Math.max(
        cumText.lastIndexOf(". "),
        cumText.lastIndexOf("! "),
        cumText.lastIndexOf("? ")
      );
      sentenceCharStart = lastBoundary >= 0 ? lastBoundary + 2 : 0;
    }

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
  }, [verificationResults, highlightedCitation, sourceSentences]);

  useEffect(() => {
    applyCitationHighlights();
  }, [applyCitationHighlights]);

  const handleArticleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const linkedTitle = getWikiArticleTitle(href);
      if (!linkedTitle) return;

      event.preventDefault();
      router.push(`/results/${encodeURIComponent(linkedTitle)}`);
    },
    [router]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white text-black">
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      <div
        ref={containerRef}
        onClick={handleArticleClick}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-none bg-white px-6 py-4 wikipedia-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
