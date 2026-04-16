import { NextRequest } from "next/server";
import { verifyCitationWithEscalation } from "@/lib/gemini";
import { Citation } from "@/lib/parser";

const MARKITDOWN_SERVICE_URL = process.env.MARKITDOWN_SERVICE_URL || "http://localhost:5000";
const MAX_CONCURRENT = 5;

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

    // Use streaming response so frontend gets results one by one
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Cache source content — never fetch the same URL twice
        const sourceCache = new Map<string, { markdown: string; sourceType: string }>();

        // Process citations in batches for controlled parallelism
        for (let i = 0; i < citations.length; i += MAX_CONCURRENT) {
          const batch = citations.slice(i, i + MAX_CONCURRENT);

          const results = await Promise.allSettled(
            batch.map(async (citation) => {
              try {
                // Fetch source content (with caching)
                const source = await fetchSource(citation.sourceUrl, sourceCache);

                if (!source.markdown) {
                  return {
                    number: citation.number,
                    verdict: "unverifiable" as const,
                    confidence: 0,
                    explanation: source.error || "Could not retrieve source",
                    relevant_passage: null,
                    sourceType: source.sourceType,
                  };
                }

                // Verify with Gemini
                const result = await verifyCitationWithEscalation(
                  citation.claim,
                  source.markdown
                );

                return {
                  number: citation.number,
                  verdict: result.verdict,
                  confidence: result.confidence,
                  explanation: result.explanation,
                  relevant_passage: result.relevant_passage,
                  sourceType: source.sourceType,
                };
              } catch {
                return {
                  number: citation.number,
                  verdict: "unverifiable" as const,
                  confidence: 0,
                  explanation: "Verification failed due to an error",
                  relevant_passage: null,
                  sourceType: "unknown",
                };
              }
            })
          );

          // Stream each result as a newline-delimited JSON line
          for (const result of results) {
            const value =
              result.status === "fulfilled"
                ? result.value
                : {
                    number: 0,
                    verdict: "unverifiable",
                    confidence: 0,
                    explanation: "Verification failed",
                    relevant_passage: null,
                    sourceType: "unknown",
                  };

            controller.enqueue(
              encoder.encode(JSON.stringify(value) + "\n")
            );
          }
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

async function fetchSource(
  url: string,
  cache: Map<string, { markdown: string; sourceType: string }>
): Promise<{ markdown: string | null; sourceType: string; error?: string }> {
  // Check cache first
  if (cache.has(url)) {
    const cached = cache.get(url)!;
    return { markdown: cached.markdown, sourceType: cached.sourceType };
  }

  try {
    // Try Python microservice first
    const serviceResponse = await fetch(`${MARKITDOWN_SERVICE_URL}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await serviceResponse.json();

    if (data.success && data.markdown) {
      cache.set(url, { markdown: data.markdown, sourceType: data.source_type });
      return { markdown: data.markdown, sourceType: data.source_type };
    }

    // Fall back to basic fetch
    return await fallbackFetchSource(url, cache);
  } catch {
    return await fallbackFetchSource(url, cache);
  }
}

async function fallbackFetchSource(
  url: string,
  cache: Map<string, { markdown: string; sourceType: string }>
): Promise<{ markdown: string | null; sourceType: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "WikiCheck/1.0 (Citation Verification Tool)" },
      signal: AbortSignal.timeout(15000),
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
      return {
        markdown: null,
        sourceType: "unavailable",
        error: "Cannot read non-text source",
      };
    }

    const html = await response.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    cache.set(url, { markdown: text, sourceType: "webpage" });
    return { markdown: text, sourceType: "webpage" };
  } catch {
    return { markdown: null, sourceType: "unavailable", error: "Failed to fetch source" };
  }
}
