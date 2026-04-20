import { NextRequest } from "next/server";
import { verifyCitationWithEscalation, verifyCitationWithUrlContext } from "@/lib/gemini";
import { Citation } from "@/lib/types";

const MARKITDOWN_SERVICE_URL = process.env.MARKITDOWN_SERVICE_URL || "http://localhost:3001";
const MAX_CONCURRENT = 5;
/** Max time (ms) to spend on a single citation before marking it unverifiable */
const CITATION_TIMEOUT_MS = 30_000;

interface VerifyRequest {
  citations: Citation[];
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyRequest = await request.json();
    const { citations } = body;

    if (!citations || !Array.isArray(citations) || citations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No citations provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Cache source content — never fetch the same URL twice
        const sourceCache = new Map<string, { markdown: string; sourceType: string }>();

        // Process citations in batches of MAX_CONCURRENT.
        // Each promise streams its result the instant it resolves.
        for (let i = 0; i < citations.length; i += MAX_CONCURRENT) {
          const batch = citations.slice(i, i + MAX_CONCURRENT);

          await Promise.all(
            batch.map(async (citation) => {
              // Race the verification against a hard per-citation timeout so a
              // hanging source fetch never blocks the rest of the queue.
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Timeout after ${CITATION_TIMEOUT_MS / 1000}s`)),
                  CITATION_TIMEOUT_MS
                )
              );

              let result;
              try {
                result = await Promise.race([
                  verifySingleCitation(citation, sourceCache),
                  timeoutPromise,
                ]);
              } catch (err) {
                const isTimeout = err instanceof Error && err.message.startsWith("Timeout");
                console.warn(
                  `[Verify] Citation [${citation.number}] ${isTimeout ? "timed out" : "errored"}: ${err}`
                );
                result = {
                  id: citation.id,
                  number: citation.number,
                  verdict: "unverifiable" as const,
                  confidence: 0,
                  explanation: isTimeout
                    ? `Verification timed out after ${CITATION_TIMEOUT_MS / 1000}s — the source may be very slow or unresponsive.`
                    : "Verification failed due to an error.",
                  relevant_passage: null,
                  sourceType: "unavailable",
                };
              }

              // ⚡ Stream immediately — don't wait for the rest of the batch
              controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
            })
          );
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Verify one citation: fetch source → verify with Gemini.
 * Falls back to Gemini URL context if the Python service can't read the source.
 */
async function verifySingleCitation(
  citation: Citation,
  sourceCache: Map<string, { markdown: string; sourceType: string }>
) {
  const source = await fetchSource(citation.sourceUrl, citation.pageRange, sourceCache);

  if (!source.markdown) {
    // ── Fallback: try Gemini URL Context (reads the same URL directly) ──────
    // NOTE: We do NOT fall back to Google Search — that would verify
    // the claim against a *different* source, defeating the purpose.
    console.log(
      `[Verify] Python service couldn't fetch [${citation.number}], trying Gemini URL context...`
    );
    try {
      const urlResult = await verifyCitationWithUrlContext(citation.claim, citation.sourceUrl);
      return {
        id: citation.id,
        number: citation.number,
        verdict: urlResult.verdict,
        confidence: urlResult.confidence,
        explanation: urlResult.explanation,
        relevant_passage: urlResult.relevant_passage,
        sourceType: "url_context",
      };
    } catch {
      // Both fetchers failed — cannot read this source at all
      console.log(
        `[Verify] URL context also failed for [${citation.number}] — marking unverifiable`
      );
      return {
        id: citation.id,
        number: citation.number,
        verdict: "unverifiable" as const,
        confidence: 0,
        explanation:
          source.error ||
          "Could not access the cited source — the link may be paywalled, broken, or a non-readable format.",
        relevant_passage: null,
        sourceType: "unavailable",
      };
    }
  }

  // Verify with Gemini
  const geminiResult = await verifyCitationWithEscalation(citation.claim, source.markdown);
  return {
    id: citation.id,
    number: citation.number,
    verdict: geminiResult.verdict,
    confidence: geminiResult.confidence,
    explanation: geminiResult.explanation,
    relevant_passage: geminiResult.relevant_passage,
    sourceType: source.sourceType,
  };
}

async function fetchSource(
  url: string,
  pageRange: string | undefined,
  cache: Map<string, { markdown: string; sourceType: string }>
): Promise<{ markdown: string | null; sourceType: string; error?: string }> {
  const cacheKey = pageRange ? `${url}#${pageRange}` : url;

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    return { markdown: cached.markdown, sourceType: cached.sourceType };
  }

  try {
    const serviceResponse = await fetch(`${MARKITDOWN_SERVICE_URL}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, page_range: pageRange }),
      signal: AbortSignal.timeout(25000), // 25s — leaves room within the 30s citation timeout
    });

    const data = await serviceResponse.json();

    if (data.success && data.markdown) {
      cache.set(cacheKey, { markdown: data.markdown, sourceType: data.source_type });
      return { markdown: data.markdown, sourceType: data.source_type };
    }

    return await fallbackFetchSource(url, cacheKey, cache);
  } catch {
    return await fallbackFetchSource(url, cacheKey, cache);
  }
}

async function fallbackFetchSource(
  url: string,
  cacheKey: string,
  cache: Map<string, { markdown: string; sourceType: string }>
): Promise<{ markdown: string | null; sourceType: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "WikiCheck/1.0 (Citation Verification Tool)" },
      signal: AbortSignal.timeout(12000), // 12s for direct fetch
    });

    if (!response.ok) {
      const error =
        response.status === 404
          ? "Source not found"
          : response.status === 403
            ? "Source requires subscription"
            : `HTTP error ${response.status}`;
      return { markdown: null, sourceType: "unavailable", error };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/") && !contentType.includes("html")) {
      return { markdown: null, sourceType: "unavailable", error: "Cannot read non-text source" };
    }

    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    cache.set(cacheKey, { markdown: text, sourceType: "webpage" });
    return { markdown: text, sourceType: "webpage" };
  } catch {
    return { markdown: null, sourceType: "unavailable", error: "Failed to fetch source" };
  }
}
