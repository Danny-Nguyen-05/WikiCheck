"use client";

import { useState } from "react";
import type { Citation } from "@/lib/types";

interface CitationPickerProps {
  citations: Citation[];
  onConfirm: (selected: Citation[]) => void;
  onCancel: () => void;
}

export default function CitationPicker({
  citations,
  onConfirm,
  onCancel,
}: CitationPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(citations.map((c) => c.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function handleConfirm() {
    const picked = citations.filter((c) => selected.has(c.id));
    if (picked.length > 0) onConfirm(picked);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-4  ">
        <h2 className="text-lg font-bold text-gray-900 ">
          Select Verifiable Citations
        </h2>
        <p className="mt-1 text-sm text-gray-500 ">
          Choose which extracted claim-source pairs to check ({selected.size} of {citations.length} selected)
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={selectAll}
            className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200   "
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200   "
          >
            Clear
          </button>
        </div>
      </div>

      {/* Citation list */}
      <div className="flex-1 overflow-y-auto overscroll-y-none p-4">
        <div className="space-y-2">
          {citations.map((citation) => (
            <button
              key={citation.id}
              onClick={() => toggle(citation.id)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selected.has(citation.id)
                  ? "border-blue-500 bg-blue-50  "
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50   "
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    selected.has(citation.id)
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-gray-300 "
                  }`}
                >
                  {selected.has(citation.id) && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500 ">
                      [{citation.number}]
                    </span>
                    <span className="truncate text-xs text-blue-600 ">
                      {citation.sourceUrl}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700  line-clamp-2">
                    {citation.claim}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3 border-t border-gray-200 bg-white px-4 py-3  ">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50   "
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Verify {selected.size} Item{selected.size !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
