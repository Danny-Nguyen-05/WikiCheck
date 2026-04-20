"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { CitationResult } from "@/lib/types";

// ── Verdict styles ────────────────────────────────────────────────────────────
const verdictStyles = {
  supported: {
    bg: "bg-green-50",
    border: "border-green-200",
    badge: "bg-green-100 text-green-800",
    label: "Supported",
    emoji: "✅",
    desc: "Your citation supports the claim. Safe to submit.",
  },
  partial: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800",
    label: "Partially Supported",
    emoji: "⚠️",
    desc: "The source partially supports the claim. Consider clarifying the wording.",
  },
  unsupported: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800",
    label: "Unsupported",
    emoji: "❌",
    desc: "The source does not support this claim. Find a better citation.",
  },
  unverifiable: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-800",
    label: "Unverifiable",
    emoji: "❓",
    desc: "Could not read the source — it may be paywalled or broken.",
  },
};

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
      <p className="text-sm text-gray-500">Fetching source and verifying…</p>
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────
function ResultCard({ result, claim, sourceUrl }: { result: CitationResult; claim: string; sourceUrl: string }) {
  const style = verdictStyles[result.verdict] ?? verdictStyles.unverifiable;

  return (
    <div className={`rounded-2xl border p-6 ${style.bg} ${style.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${style.badge}`}>
          {style.emoji} {style.label}
        </span>
        <span className="text-lg font-bold text-gray-700">{result.confidence}%</span>
      </div>

      {/* Summary sentence */}
      <p className="mt-3 text-sm text-gray-600">{style.desc}</p>

      {/* Claim */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Your Claim</p>
        <p className="mt-1 text-sm text-gray-800">"{claim}"</p>
      </div>

      {/* Source */}
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Citation URL</p>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block truncate text-sm text-blue-600 hover:underline"
        >
          {sourceUrl}
        </a>
      </div>

      {/* Relevant passage */}
      {result.relevant_passage && (
        <div className="mt-4 rounded-xl bg-white/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Found in Source</p>
          <p className="mt-1 text-sm italic text-gray-700">"{result.relevant_passage}"</p>
        </div>
      )}

      {/* AI explanation */}
      <p className="mt-4 text-sm text-gray-700">
        <span className="font-semibold">AI note:</span> {result.explanation}
      </p>
    </div>
  );
}

// ── Main inner page ───────────────────────────────────────────────────────────
function DraftPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [claim, setClaim]         = useState(searchParams.get("claim") ?? "");
  const [sourceUrl, setSourceUrl] = useState(searchParams.get("url") ?? "");
  const [result, setResult]       = useState<CitationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const articleTitle = searchParams.get("article") ?? "";

  const verify = useCallback(async () => {
    if (!claim.trim() || !sourceUrl.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const mockCitation = {
        id: "draft-1",
        number: 1,
        claim: claim.trim(),
        sourceUrl: sourceUrl.trim(),
      };

      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citations: [mockCitation] }),
      });

      if (!res.ok || !res.body) {
        setError("Verification failed. Please try again.");
        return;
      }

      // Read the first (and only) NDJSON line
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed: CitationResult = JSON.parse(line);
            setResult(parsed);
            return; // Only one citation, done
          } catch { /* skip */ }
        }
      }
    } catch {
      setError("Something went wrong. Check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  }, [claim, sourceUrl]);



  const canVerify = claim.trim().length > 0 && sourceUrl.trim().length > 0;

  return (
    <main className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          {/* Back button — uses browser history so the article page state is fully preserved */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <Link href="/" className="shrink-0 text-xl font-semibold tracking-tight text-[#1d1d1f]">
            Wiki<span className="text-blue-500">Check</span>
          </Link>
          {articleTitle && (
            <span className="truncate text-sm text-gray-400">{articleTitle}</span>
          )}
          <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            ✏️ Check My Edit
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Check My Edit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Paste your claim and citation URL. We'll verify the source actually supports what you're writing before you submit it to Wikipedia.
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {/* Claim */}
          <div>
            <label className="block text-sm font-semibold text-gray-700" htmlFor="claim-input">
              Your claim
              <span className="ml-1 font-normal text-gray-400">(the sentence you want to add or edit)</span>
            </label>
            <textarea
              id="claim-input"
              value={claim}
              onChange={(e) => { setClaim(e.target.value); setResult(null); }}
              rows={3}
              placeholder='e.g. "Einstein won the Nobel Prize in Physics in 1921."'
              className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            />
          </div>

          {/* Citation URL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700" htmlFor="url-input">
              Citation URL
              <span className="ml-1 font-normal text-gray-400">(the source you're citing)</span>
            </label>
            <input
              id="url-input"
              type="url"
              value={sourceUrl}
              onChange={(e) => { setSourceUrl(e.target.value); setResult(null); }}
              placeholder="https://example.com/source-article"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20"
            />
          </div>

          {/* Verify button */}
          <button
            onClick={verify}
            disabled={!canVerify || isLoading}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Verifying…" : "Verify Citation"}
          </button>
        </div>

        {/* Loading */}
        {isLoading && <Spinner />}

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && !isLoading && (
          <div className="mt-6 flex flex-col gap-4">
            <ResultCard result={result} claim={claim} sourceUrl={sourceUrl} />

            {/* Action row */}
            <div className="flex flex-wrap gap-3">
              {/* Good result → open Wikipedia editor */}
              {(result.verdict === "supported" || result.verdict === "partial") && articleTitle && (
                <a
                  href={`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(articleTitle.replace(/ /g, "_"))}&action=edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                >
                  Open Wikipedia Editor ↗
                </a>
              )}
              {/* Try again with different URL */}
              <button
                onClick={() => { setResult(null); setSourceUrl(""); }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                Try a Different Source
              </button>
              {/* Back button — restores previous page with all its state intact */}
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                ← Back to Article
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function DraftPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-[#fbfbfd]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </main>
    }>
      <DraftPageInner />
    </Suspense>
  );
}
