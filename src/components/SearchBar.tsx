"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/types";

interface SearchBarProps {
  variant?: "default" | "compact";
}

export default function SearchBar({ variant = "default" }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
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
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(title: string) {
    setIsOpen(false);
    setQuery("");
    router.push(`/results/${encodeURIComponent(title)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim()) {
      setIsOpen(false);
      const q = query.trim();
      setQuery("");
      router.push(`/results/${encodeURIComponent(q)}`);
    }
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
          onFocus={() => results.length > 0 && setIsOpen(true)}
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

      {isOpen && results.length > 0 && (
        <div className={`absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-gray-100 bg-white/80 backdrop-blur-xl shadow-xl ${isCompact ? "text-sm" : "text-base"}`}>
          {results.map((result) => (
            <button
              key={result.title}
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

