"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import ArticlePanel from "@/components/ArticlePanel";
import VerificationPanel from "@/components/VerificationPanel";
import CitationPicker from "@/components/CitationPicker";
import SearchBar from "@/components/SearchBar";
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
  const [panelWidth, setPanelWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // sessionStorage key for this article — used to persist state across navigation
  const STATE_KEY = `wikicheck-${title}`;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate right panel width percentage based on mouse position
      const newWidth = ((document.body.clientWidth - e.clientX) / document.body.clientWidth) * 100;
      // Constrain panel width between 20% and 80%
      if (newWidth > 20 && newWidth < 80) setPanelWidth(newWidth);
    };

    const handleMouseUp = () => setIsDragging(false);

    // Disable text selection globally while dragging to prevent janky UX
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    
    return () => {
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const articleVerificationResults = useMemo(() => {
    const byNumber = new Map<number, CitationResult>();
    verificationResults.forEach((result) => {
      byNumber.set(result.number, result);
    });
    return byNumber;
  }, [verificationResults]);

  // Build sourceSentence map for ArticlePanel's direct text search
  const sourceSentencesMap = useMemo(() => {
    const m = new Map<number, string>();
    citations.forEach((c) => {
      if (c.sourceSentence) m.set(c.number, c.sourceSentence);
    });
    return m;
  }, [citations]);

  // ── Fetch article (or restore from sessionStorage cache) ───────────────────
  useEffect(() => {
    // Try restoring a full snapshot first — this is what makes "Back" work
    // without losing verification results.
    const saved = sessionStorage.getItem(STATE_KEY);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.articleHtml) {
          setArticleHtml(s.articleHtml);
          setArticleTitle(s.articleTitle ?? title);
          setCitations(s.citations ?? []);
          setActiveCitations(s.activeCitations ?? []);
          setVerificationResults(new Map(s.verificationResults ?? []));
          // Restore mode — if verification was running when they left, mark as
          // paused so they can resume (verification can't run in the background).
          const savedMode: Mode = s.mode ?? "article";
          setMode(savedMode);
          if (savedMode === "verifying") setIsPaused(true);
          setIsLoadingArticle(false);
          return; // Skip network fetch — everything already restored
        }
      } catch { /* corrupted entry — fall through to fetch */ }
    }

    // No cache: fetch from Wikipedia API
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // ── Persist state to sessionStorage on every meaningful change ──────────────
  // Runs after every render where the article is loaded. Serializes the Map as
  // an array of [key, value] pairs (JSON doesn't support Maps natively).
  useEffect(() => {
    if (!articleHtml) return; // Nothing to save yet
    const snapshot = {
      mode,
      articleHtml,
      articleTitle,
      citations,
      activeCitations,
      verificationResults: Array.from(verificationResults.entries()),
    };
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(snapshot));
    } catch { /* QuotaExceededError — storage full, skip silently */ }
  }, [STATE_KEY, mode, articleHtml, articleTitle, citations, activeCitations, verificationResults]);

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
          <h1 className="mb-2 text-2xl font-bold text-gray-900 ">
            {error}
          </h1>
          <p className="text-gray-500 ">
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
          <p className="text-gray-600 ">Loading article...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col overflow-hidden bg-[#fbfbfd]" style={{ height: "100vh" }}>
      {/* Top Header Bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur-md">
        <div className="flex flex-1 items-center gap-6">
          <Link href="/" className="text-xl font-semibold tracking-tight text-[#1d1d1f]">
            Wiki<span className="text-blue-500">Check</span>
          </Link>
          <div className="w-full max-w-lg">
            <SearchBar variant="compact" />
          </div>
        </div>

        {mode === "article" && (
          <div className="flex items-center gap-3">
            {citations.length > 0 && (
              <span className="mr-2 text-xs font-medium text-gray-400">
                {citations.length} verifiable
              </span>
            )}
            <button
              onClick={handleSpecificCheck}
              disabled={citations.length === 0}
              className="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-[#1d1d1f] transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Single citation check
            </button>
            <button
              onClick={handleFullCheck}
              disabled={citations.length === 0}
              className="rounded-full bg-blue-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Full citations check
            </button>
            <Link
              href={`/draft?article=${encodeURIComponent(articleTitle)}`}
              className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              ✏️ Check My Edit
            </Link>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex min-h-0 flex-1">
        {/* Article Panel */}
        <div className="min-w-0 flex-1 overflow-hidden bg-white shadow-sm">
          <ArticlePanel
            html={articleHtml}
            title={articleTitle}
            verificationResults={articleVerificationResults}
            highlightedCitation={highlightedCitation}
            sourceSentences={sourceSentencesMap}
          />
        </div>

        {/* Resizer Handle */}
        {(mode === "picking" || mode === "verifying") && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            className="group relative z-10 w-1 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-400 active:bg-blue-500 max-md:hidden"
          >
            {/* Visual grabber */}
            <div className="absolute top-1/2 left-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-400 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
            
            {/* Wider invisible hit area for easier grabbing */}
            <div className="absolute top-0 bottom-0 left-1/2 w-4 -translate-x-1/2 bg-transparent" />
          </div>
        )}

        {/* Slide-over panel for picking or verifying */}
        {(mode === "picking" || mode === "verifying") && (
          <div 
            style={{ width: `${panelWidth}%` }}
            className="shrink-0 overflow-hidden bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.02)] max-md:!w-full"
          >
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
                articleTitle={articleTitle}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
