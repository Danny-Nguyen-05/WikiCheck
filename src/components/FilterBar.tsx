"use client";

import type { Verdict } from "@/lib/types";

interface FilterBarProps {
  active: Verdict | "all";
  onChange: (filter: Verdict | "all") => void;
  counts: Record<Verdict | "all", number>;
}

const filters: { key: Verdict | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "supported", label: "✅ Supported" },
  { key: "partial", label: "⚠️ Partial" },
  { key: "unsupported", label: "❌ Unsupported" },
  { key: "unverifiable", label: "🔒 Unverifiable" },
];

export default function FilterBar({ active, onChange, counts }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            active === key
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200   "
          }`}
        >
          {label}
          <span className="ml-1.5 text-xs opacity-70">({counts[key]})</span>
        </button>
      ))}
    </div>
  );
}
