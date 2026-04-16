"use client";

import type { Verdict } from "@/lib/types";

interface SummaryBarProps {
  supported: number;
  partial: number;
  unsupported: number;
  unverifiable: number;
  total: number;
}

const verdictConfig: Record<Verdict, { emoji: string; label: string; color: string }> = {
  supported: { emoji: "✅", label: "Supported", color: "text-green-600 dark:text-green-400" },
  partial: { emoji: "⚠️", label: "Partial", color: "text-yellow-600 dark:text-yellow-400" },
  unsupported: { emoji: "❌", label: "Unsupported", color: "text-red-600 dark:text-red-400" },
  unverifiable: { emoji: "🔒", label: "Unverifiable", color: "text-gray-500 dark:text-gray-400" },
};

export default function SummaryBar({
  supported,
  partial,
  unsupported,
  unverifiable,
  total,
}: SummaryBarProps) {
  const counts = { supported, partial, unsupported, unverifiable };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
      {(Object.keys(verdictConfig) as Verdict[]).map((verdict) => (
        <span
          key={verdict}
          className={`flex items-center gap-1.5 text-sm font-medium ${verdictConfig[verdict].color}`}
        >
          <span>{verdictConfig[verdict].emoji}</span>
          <span>{counts[verdict]}</span>
        </span>
      ))}
      <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
        {supported + partial + unsupported + unverifiable} / {total} verified
      </span>
    </div>
  );
}
