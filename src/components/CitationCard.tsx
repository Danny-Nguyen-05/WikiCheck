"use client";

import Link from "next/link";
import type { CitationResult, Verdict } from "@/lib/types";

interface CitationCardProps {
  result: CitationResult;
  claim: string;
  sourceUrl: string;
  onHighlight: (number: number) => void;
  /** Article title — used to build the "Fix This" link back to /draft */
  articleTitle?: string;
}

const verdictStyles: Record<
  Verdict,
  { bg: string; border: string; badge: string; label: string; emoji: string }
> = {
  supported: {
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-800",
    label: "Supported",
    emoji: "✅",
  },
  partial: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800",
    label: "Partially Supported",
    emoji: "⚠️",
  },
  unsupported: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800",
    label: "Unsupported",
    emoji: "❌",
  },
  unverifiable: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-800",
    label: "Unverifiable",
    emoji: "❓",
  },
};

/** Consistent SVG icons per source type — renders identically on every OS & browser */
function SourceIcon({ type }: { type: string }) {
  switch (type) {
    case "pdf":
      // Red document icon
      return (
        <svg className="inline h-3.5 w-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      );
    case "document":
      // Blue document icon
      return (
        <svg className="inline h-3.5 w-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v1H7V5zm0 3h6v1H7V8zm0 3h4v1H7v-1z" clipRule="evenodd" />
        </svg>
      );
    case "webpage":
      // Green globe icon
      return (
        <svg className="inline h-3.5 w-3.5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
        </svg>
      );
    case "spreadsheet":
    case "presentation":
      // Grid icon
      return (
        <svg className="inline h-3.5 w-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1H5zm1 2h3v2H6V6zm0 4h3v2H6v-2zm4-4h3v2h-3V6zm0 4h3v2h-3v-2z" clipRule="evenodd" />
        </svg>
      );
    case "url_context":
      // Purple link icon — Gemini read the exact citation URL directly
      return (
        <svg className="inline h-3.5 w-3.5 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case "unavailable":

      // Grey crossed-circle icon
      return (
        <svg className="inline h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M4.93 4.93l14.14 14.14" />
        </svg>
      );
    default:
      // Grey question-mark icon
      return (
        <svg className="inline h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

export default function CitationCard({
  result,
  claim,
  sourceUrl,
  onHighlight,
  articleTitle,
}: CitationCardProps) {
  const style = verdictStyles[result.verdict];
  const canFix = result.verdict === "unsupported" || result.verdict === "unverifiable";

  const fixHref = `/draft?${new URLSearchParams({
    claim,
    url: sourceUrl,
    ...(articleTitle ? { article: articleTitle } : {}),
  }).toString()}`;

  return (
    <div className={`rounded-lg border p-4 transition-all ${style.bg} ${style.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-500">
            [{result.number}]
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
            {style.emoji} {style.label}
          </span>
        </div>
        <span className="text-sm font-semibold text-gray-700">
          {result.confidence}%
        </span>
      </div>

      {/* Claim */}
      <div className="mt-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Claim
        </span>
        <p className="mt-0.5 text-sm text-gray-900 line-clamp-2">
          &ldquo;{claim}&rdquo;
        </p>
      </div>

      {/* Source */}
      <div className="mt-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          Source <SourceIcon type={result.sourceType} />
        </span>
        <p className="mt-0.5 truncate text-sm text-blue-600">
          {sourceUrl}
        </p>
      </div>

      {/* Relevant Passage */}
      {result.relevant_passage && (
        <div className="mt-2 rounded-md bg-white/60 p-2">
          <p className="text-sm italic text-gray-600 line-clamp-3">
            &ldquo;{result.relevant_passage}&rdquo;
          </p>
        </div>
      )}

      {/* AI Explanation */}
      <p className="mt-2 text-sm text-gray-700">
        <span className="font-medium">AI note:</span> {result.explanation}
      </p>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-3">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          View Source ↗
        </a>
        <button
          onClick={() => onHighlight(result.number)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Highlight in Article
        </button>
        {canFix && (
          <Link
            href={fixHref}
            className="ml-auto text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            Fix This →
          </Link>
        )}
      </div>
    </div>
  );
}
