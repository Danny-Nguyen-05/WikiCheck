"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/types";

interface SearchBarProps {
  variant?: "default" | "compact";
  /** Pre-fills the input (used on the search results page) */
  initialQuery?: string;
}

export default function SearchBar({ variant = "default", initialQuery = "" }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // When true the next query state change came from props (not user typing)
  // and must NOT trigger a fetch or open the dropdown.
  const skipNextFetch = useRef(false);
  const router = useRouter();

  // Sync initialQuery from parent WITHOUT triggering a search or opening dropdown
  useEffect(() => {
    skipNextFetch.current = true;
    setQuery(initialQuery);
    setIsOpen(false);
    setResults([]);
  }, [initialQuery]);

  // Close when clicking outside the component
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search — skipped when the query change came from props
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        // Only open if the user still has the input focused
        if (isFocused) setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // isFocused intentionally omitted — we only want this to re-run when query changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Clicking a suggestion → go to the search results page (same as pressing Enter)
  function handleSelect(title: string) {
    setIsOpen(false);
    setIsFocused(false);
    setQuery(title);
    router.push(`/search?q=${encodeURIComponent(title)}`);
  }

  // Enter → search results page; Escape → close dropdown
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim()) {
      setIsOpen(false);
      setIsFocused(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  function handleFocus() {
    setIsFocused(true);
    if (results.length > 0) setIsOpen(true);
  }

  function handleBlur() {
    // Small delay so a click on a suggestion fires before we close
    setTimeout(() => {
      setIsFocused(false);
      setIsOpen(false);
    }, 150);
  }

  const isCompact = variant === "compact";

  return (
    <div ref={containerRef} className={`relative w-full ${isCompact ? "max-w-md" : "max-w-2xl"}`}>
      <div className="relative flex items-center">
        <svg
          className={`absolute left-4 text-gray-400 ${isCompact ? "h-4 w-4" : "h-5 w-5"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search Wikipedia articles..."
          className={`
            w-full rounded-full border border-gray-200 bg-white placeholder-gray-400
            transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10
            ${isCompact ? "py-2 pl-10 pr-10 text-sm shadow-sm hover:shadow-md" : "py-4 pl-12 pr-6 text-lg shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.12)]"}
          `}
        />
        {isLoading && (
          <div className="absolute right-4">
            <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-blue-500 ${isCompact ? "h-4 w-4" : "h-5 w-5"}`} />
          </div>
        )}
      </div>

      {/* Dropdown — only visible when the user actively has the input focused */}
      {isFocused && isOpen && results.length > 0 && (
        <div className={`absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-gray-100 bg-white/80 backdrop-blur-xl shadow-xl ${isCompact ? "text-sm" : "text-base"}`}>
          {results.map((result) => (
            <button
              key={result.title}
              // Prevent the input blur from firing before the click
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(result.title)}
              className="flex w-full flex-col px-5 py-3 text-left transition-colors hover:bg-black/5"
            >
              <span className="font-semibold text-gray-900 tracking-tight">
                {result.title}
              </span>
              {result.description && (
                <span className="mt-0.5 text-gray-500 line-clamp-1">
                  {result.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
