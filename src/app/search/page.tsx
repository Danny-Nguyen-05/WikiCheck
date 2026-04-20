"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import type { SearchResult } from "@/lib/types";

/** Wikipedia "W" logo rendered as an inline SVG square — matches the Google result favicon style */
function WikipediaFavicon() {
  return (
    <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] bg-[#1a1a1a]">
      {/* Classic Wikipedia W */}
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="white">
        <path d="M12.09 2C6.545 2 2 6.544 2 12.09c0 4.48 2.886 8.312 6.918 9.69l.072-.122L12 16.3l3.01 5.458.072.123C19.114 20.402 22 16.57 22 12.09 22 6.544 17.455 2 12.09 2zm-.497 3.5h.832l1.666 6.168.972-3.668h.808L16.4 14.5l1.4-5.668h.8l-1.8 7h-.832l-1.087-4.1-1.087 4.1h-.832l-1.8-7h.8l1.4 5.668.972-3.5-1.532-5.5zM7.8 7.832h.8l1.8 7h-.832l-1.087-4.1L7.4 14.832h-.832l-1.8-7h.8l1.4 5.668.972-3.5-1.14-4.168z" />
      </svg>
    </div>
  );
}

function SearchResultCard({
  result,
  index,
}: {
  result: SearchResult;
  index: number;
}) {
  const router = useRouter();
  const slug = result.title.replace(/ /g, "_");

  return (
    <div
      className="group flex cursor-pointer flex-col gap-0 rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm transition-all duration-200 hover:border-blue-200 hover:shadow-md"
      style={{ animationDelay: `${index * 40}ms` }}
      onClick={() => router.push(`/results/${encodeURIComponent(result.title)}`)}
    >
      {/* Row 1: favicon + site name + URL */}
      <div className="mb-2 flex items-center gap-2">
        <WikipediaFavicon />
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-medium text-gray-800">Wikipedia</span>
          <span className="text-[12px] text-gray-500">
            https://en.wikipedia.org › wiki › {slug}
          </span>
        </div>
      </div>

      {/* Row 2: Clickable blue title */}
      <h2 className="mb-2 text-[20px] font-normal leading-snug text-[#1a0dab] group-hover:underline">
        {result.title} - Wikipedia
      </h2>

      {/* Row 3: extract snippet (real article intro) or fallback description */}
      {(result.extract || result.description) && (
        <p className="text-[14px] leading-[1.58] text-gray-700">
          {result.extract
            ? result.extract.length > 300
              ? result.extract.slice(0, 300) + "…"
              : result.extract + "…"
            : result.description + "…"}
        </p>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
      <div className="h-3 w-48 animate-pulse rounded-full bg-gray-100" />
      <div className="h-5 w-64 animate-pulse rounded-full bg-gray-200" />
      <div className="h-3 w-full animate-pulse rounded-full bg-gray-100" />
      <div className="h-3 w-3/4 animate-pulse rounded-full bg-gray-100" />
    </div>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setIsLoading(true);
    setHasSearched(false);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, []);

  useEffect(() => {
    if (query) {
      fetchResults(query);
    }
  }, [query, fetchResults]);

  return (
    <main className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
          <Link
            href="/"
            className="shrink-0 text-xl font-semibold tracking-tight text-[#1d1d1f]"
          >
            Wiki<span className="text-blue-500">Check</span>
          </Link>
          <div className="w-full max-w-xl">
            <SearchBar variant="compact" initialQuery={query} />
          </div>
        </div>
      </header>

      {/* Results */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Stats row */}
        {hasSearched && !isLoading && (
          <p className="mb-6 text-sm text-gray-500">
            {results.length > 0 ? (
              <>
                About{" "}
                <span className="font-semibold text-gray-700">
                  {results.length}
                </span>{" "}
                Wikipedia articles matched{" "}
                <span className="font-medium text-gray-700">
                  &ldquo;{query}&rdquo;
                </span>
                , sorted by relevance
              </>
            ) : (
              <>
                No Wikipedia articles found for{" "}
                <span className="font-medium text-gray-700">
                  &ldquo;{query}&rdquo;
                </span>
              </>
            )}
          </p>
        )}

        {/* Skeleton loading */}
        {isLoading && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Result cards */}
        {!isLoading && results.length > 0 && (
          <div className="flex flex-col gap-4">
            {results.map((result, i) => (
              <SearchResultCard key={result.title} result={result} index={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg
                className="h-8 w-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                No results found
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Try a different search term or check the spelling.
              </p>
            </div>
            <Link
              href="/"
              className="mt-2 rounded-full bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Back to Search
            </Link>
          </div>
        )}

        {/* No query state */}
        {!query && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-gray-500">
              Enter a search term above to find Wikipedia articles.
            </p>
            <Link
              href="/"
              className="rounded-full bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Go to Home
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fbfbfd]">
          <div className="flex h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        </main>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
