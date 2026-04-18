"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import ArticlePanel from "@/components/ArticlePanel";
import VerificationPanel from "@/components/VerificationPanel";
import CitationPicker from "@/components/CitationPicker";
import type { Citation, CitationResult } from "@/lib/types";

type Mode = "article" | "picking" | "verifying";

export default function ResultsPage() {
  const params = useParams();
  const title = decodeURIComponent(params.title as string);

  const [articleHtml, setArticleHtml] = useState("");
  const [articleTitle, setArticleTitle] = useState(title);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [verificationResults, setVerificationResults] = useState<Map<string, CitationResult>>(
    new Map()
  );
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mode, setMode] = useState<Mode>("article");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const articleVerificationResults = useMemo(() => {
    const byNumber = new Map<number, CitationResult>();
    verificationResults.forEach((result) => {
      byNumber.set(result.number, result);
    });
    return byNumber;
  }, [verificationResults]);

  // Fetch article
  useEffect(() => {
    async function fetchArticle() {
      setIsLoadingArticle(true);
      setError(null);
      try {
        const res = await fetch(`/api/article?title=${encodeURIComponent(title)}`);
        if (!res.ok) {
          setError("Article not found");
          return;
        }
        const data = await res.json();
        setArticleHtml(data.html);
        setArticleTitle(data.title || title);
        setCitations(data.citations || []);
      } catch {
        setError("Failed to load article");
      } finally {
        setIsLoadingArticle(false);
      }
    }
    fetchArticle();
  }, [title]);

  // Verify a set of citations (used for both initial run and resume)
  const verifyCitations = useCallback(async (toVerify: Citation[]) => {
    if (toVerify.length === 0) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsVerifying(true);
    setIsPaused(false);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ citations: toVerify }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setError("Verification failed");
        setIsVerifying(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const result: CitationResult = JSON.parse(line);
            setVerificationResults((prev) => {
              const next = new Map(prev);
              next.set(result.id, result);
              return next;
            });
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped — not an error
        setIsPaused(true);
      } else {
        setError("Verification connection lost");
      }
    } finally {
      setIsVerifying(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function handleFullCheck() {
    setActiveCitations(citations);
    setVerificationResults(new Map());
    setMode("verifying");
  }

  function handleSpecificCheck() {
    setMode("picking");
  }

  function handlePickerConfirm(selected: Citation[]) {
    setActiveCitations(selected);
    setVerificationResults(new Map());
    setMode("verifying");
    verifyCitations(selected);
  }

  function handlePickerCancel() {
    setMode("article");
  }

  function handleBackToArticle() {
    abortControllerRef.current?.abort();
    setMode("article");
  }

  function handleStop() {
    abortControllerRef.current?.abort();
  }

  function handleContinue() {
    const remaining = activeCitations.filter((c) => !verificationResults.has(c.id));
    if (remaining.length > 0) {
      verifyCitations(remaining);
    }
  }

  function handleHighlightCitation(num: number) {
    setHighlightedCitation(num);
    // Clear highlight after animation
    setTimeout(() => setHighlightedCitation(null), 2000);
  }

  if (error && !articleHtml) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            {error}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Could not find the article &ldquo;{title}&rdquo;
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Back to Search
          </Link>
        </div>
      </main>
    );
  }

  if (isLoadingArticle) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading article...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex overflow-hidden" style={{ height: "100vh" }}>
      {/* Article Panel — always rendered, takes remaining space */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <ArticlePanel
          html={articleHtml}
          title={articleTitle}
          verificationResults={articleVerificationResults}
          highlightedCitation={highlightedCitation}
        />
      </div>

      {/* Right edge tab — always visible when in "article" mode */}
      {mode === "article" && (
        <div className="relative flex w-14 shrink-0 flex-col items-center justify-center gap-4 border-l border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-900">
          <button
            onClick={handleFullCheck}
            disabled={citations.length === 0}
            className="group relative flex h-36 w-10 flex-col items-center justify-center gap-2 rounded-md bg-blue-600 text-white shadow transition-all hover:w-11 hover:bg-blue-700 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            title="Verify all extracted citations"
          >
            <span className="text-base">🔍</span>
            <span className="whitespace-nowrap text-[11px] font-bold tracking-wide [writing-mode:vertical-lr] rotate-180">
              Full Check
            </span>
          </button>
          <button
            onClick={handleSpecificCheck}
            disabled={citations.length === 0}
            className="group relative flex h-36 w-10 flex-col items-center justify-center gap-2 rounded-md bg-purple-600 text-white shadow transition-all hover:w-11 hover:bg-purple-700 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            title="Choose specific extracted citations to verify"
          >
            <span className="text-base">📋</span>
            <span className="whitespace-nowrap text-[11px] font-bold tracking-wide [writing-mode:vertical-lr] rotate-180">
              Specific Check
            </span>
          </button>
          {citations.length > 0 && (
            <span className="text-[10px] font-medium text-gray-400 [writing-mode:vertical-lr] rotate-180">
              {citations.length} verifiable
            </span>
          )}
        </div>
      )}

      {/* Slide-over panel for picking or verifying */}
      {(mode === "picking" || mode === "verifying") && (
        <div className="w-1/2 shrink-0 overflow-hidden border-l border-gray-300 dark:border-gray-600 max-md:w-full">
          {mode === "picking" && (
            <CitationPicker
              citations={citations}
              onConfirm={handlePickerConfirm}
              onCancel={handlePickerCancel}
            />
          )}
          {mode === "verifying" && (
            <VerificationPanel
              citations={activeCitations}
              results={verificationResults}
              totalCitations={activeCitations.length}
              isVerifying={isVerifying}
              isPaused={isPaused}
              onStart={() => verifyCitations(activeCitations)}
              onStop={handleStop}
              onContinue={handleContinue}
              onHighlightCitation={handleHighlightCitation}
              onBack={handleBackToArticle}
            />
          )}
        </div>
      )}
    </main>
  );
}
