"use client";

import { useState, useMemo } from "react";
import type { CitationResult, Citation, Verdict } from "@/lib/types";
import SummaryBar from "./SummaryBar";
import TrustScore from "./TrustScore";
import FilterBar from "./FilterBar";
import ProgressBar from "./ProgressBar";
import CitationCard from "./CitationCard";
import SkeletonCard from "./SkeletonCard";

interface VerificationPanelProps {
  citations: Citation[];
  results: Map<string, CitationResult>;
  totalCitations: number;
  isVerifying: boolean;
  isPaused: boolean;
  onStart?: () => void;
  onStop: () => void;
  onContinue: () => void;
  onHighlightCitation: (number: number) => void;
  onBack?: () => void;
  /** Passed to CitationCard so "Fix This" links back to /draft with article context */
  articleTitle?: string;
}

export default function VerificationPanel({
  citations,
  results,
  totalCitations,
  isVerifying,
  isPaused,
  onStart,
  onStop,
  onContinue,
  onHighlightCitation,
  onBack,
  articleTitle,
}: VerificationPanelProps) {
  const [filter, setFilter] = useState<Verdict | "all">("all");

  const counts = useMemo(() => {
    const c = { all: results.size, supported: 0, partial: 0, unsupported: 0, unverifiable: 0 };
    results.forEach((r) => {
      c[r.verdict]++;
    });
    return c;
  }, [results]);

  const trustScore = useMemo(() => {
    if (results.size === 0) return 0;
    let score = 0;
    let counted = 0;
    results.forEach((r) => {
      if (r.verdict !== "unverifiable") {
        counted++;
        if (r.verdict === "supported") score += r.confidence;
        else if (r.verdict === "partial") score += r.confidence * 0.5;
      }
    });
    return counted > 0 ? Math.round(score / counted) : 0;
  }, [results]);

  const filteredCitations = useMemo(() => {
    return citations.filter((c) => {
      if (filter === "all") return true;
      const result = results.get(c.id);
      return result?.verdict === filter;
    });
  }, [citations, results, filter]);

  const pendingCount = totalCitations - results.size;
  const hasRemaining = pendingCount > 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-gray-200 bg-white px-4 py-4  ">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700   "
                title="Back to article"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-bold text-gray-900 ">
              Verification Results
            </h2>
          </div>
          <TrustScore score={trustScore} />
        </div>
        <SummaryBar
          supported={counts.supported}
          partial={counts.partial}
          unsupported={counts.unsupported}
          unverifiable={counts.unverifiable}
          total={totalCitations}
        />
        {/* Start button — shown when not yet started */}
        {!isVerifying && !isPaused && results.size === 0 && onStart && (
          <button
            onClick={onStart}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
          >
            ▶ Start Verification ({totalCitations} verifiable items)
          </button>
        )}
        {/* Progress + stop/continue — shown once verification has started */}
        {(isVerifying || (isPaused && hasRemaining)) && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar current={results.size} total={totalCitations} />
            </div>
            {isVerifying ? (
              <button
                onClick={onStop}
                className="shrink-0 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                ⏸ Stop
              </button>
            ) : isPaused && hasRemaining ? (
              <button
                onClick={onContinue}
                className="shrink-0 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                ▶ Continue
              </button>
            ) : null}
          </div>
        )}
        <FilterBar active={filter} onChange={setFilter} counts={counts} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-none p-4">
        <div className="space-y-3">
          {filteredCitations.map((citation) => {
            const result = results.get(citation.id);
            if (result) {
              return (
                <CitationCard
                  key={citation.id}
                  result={result}
                  claim={citation.claim}
                  sourceUrl={citation.sourceUrl}
                  onHighlight={onHighlightCitation}
                  articleTitle={articleTitle}
                />
              );
            }
            return null;
          })}

          {/* Skeleton cards for pending verifications */}
          {isVerifying && !isPaused &&
            filter === "all" &&
            Array.from({ length: Math.min(pendingCount, 3) }).map((_, i) => (
              <SkeletonCard key={`skeleton-${i}`} />
            ))}

          {/* Empty state */}
          {!isVerifying && filteredCitations.length === 0 && results.size > 0 && (
            <div className="py-12 text-center text-gray-500 ">
              No verifiable items match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
