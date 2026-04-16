"use client";

import type { CitationResult, Verdict } from "@/lib/types";

interface CitationCardProps {
  result: CitationResult;
  claim: string;
  sourceUrl: string;
  onHighlight: (number: number) => void;
}

const verdictStyles: Record<
  Verdict,
  { bg: string; border: string; badge: string; label: string; emoji: string }
> = {
  supported: {
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    label: "Supported",
    emoji: "✅",
  },
  partial: {
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    border: "border-yellow-200 dark:border-yellow-800",
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    label: "Partially Supported",
    emoji: "⚠️",
  },
  unsupported: {
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    label: "Unsupported",
    emoji: "❌",
  },
  unverifiable: {
    bg: "bg-gray-50 dark:bg-gray-800/50",
    border: "border-gray-200 dark:border-gray-700",
    badge: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    label: "Unverifiable",
    emoji: "🔒",
  },
};

const sourceTypeIcons: Record<string, string> = {
  pdf: "📄",
  document: "📝",
  webpage: "🌐",
  spreadsheet: "📊",
  presentation: "📊",
  unknown: "❓",
  unavailable: "⛔",
};

export default function CitationCard({
  result,
  claim,
  sourceUrl,
  onHighlight,
}: CitationCardProps) {
  const style = verdictStyles[result.verdict];

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${style.bg} ${style.border}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
            [{result.number}]
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
          >
            {style.emoji} {style.label}
          </span>
        </div>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {result.confidence}%
        </span>
      </div>

      {/* Claim */}
      <div className="mt-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Claim
        </span>
        <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
          &ldquo;{claim}&rdquo;
        </p>
      </div>

      {/* Source */}
      <div className="mt-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Source {sourceTypeIcons[result.sourceType] || sourceTypeIcons.unknown}
        </span>
        <p className="mt-0.5 truncate text-sm text-blue-600 dark:text-blue-400">
          {sourceUrl}
        </p>
      </div>

      {/* Relevant Passage */}
      {result.relevant_passage && (
        <div className="mt-2 rounded-md bg-white/60 p-2 dark:bg-gray-900/40">
          <p className="text-sm italic text-gray-600 dark:text-gray-400 line-clamp-3">
            &ldquo;{result.relevant_passage}&rdquo;
          </p>
        </div>
      )}

      {/* AI Explanation */}
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        <span className="font-medium">AI note:</span> {result.explanation}
      </p>

      {/* Actions */}
      <div className="mt-3 flex gap-3">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View Source ↗
        </a>
        <button
          onClick={() => onHighlight(result.number)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Highlight in Article
        </button>
      </div>
    </div>
  );
}
