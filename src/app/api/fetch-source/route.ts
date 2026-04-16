import { NextRequest, NextResponse } from "next/server";

const MARKITDOWN_SERVICE_URL = process.env.MARKITDOWN_SERVICE_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { markdown: null, sourceType: "unavailable", error: "No URL provided" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json(
          { markdown: null, sourceType: "unavailable", error: "Invalid URL scheme" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { markdown: null, sourceType: "unavailable", error: "Invalid URL" },
        { status: 400 }
      );
    }

    // Try Python microservice first for all file types
    try {
      const serviceResponse = await fetch(`${MARKITDOWN_SERVICE_URL}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await serviceResponse.json();

      if (data.success && data.markdown) {
        return NextResponse.json({
          markdown: data.markdown,
          sourceType: data.source_type || "webpage",
        });
      }

      // If the microservice failed, fall back to basic HTML fetch for webpages
      return await fallbackFetch(url);
    } catch {
      // Python service is down — fall back to basic fetch
      return await fallbackFetch(url);
    }
  } catch {
    return NextResponse.json(
      { markdown: null, sourceType: "unavailable", error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function fallbackFetch(url: string): Promise<NextResponse> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "WikiCheck/1.0 (Citation Verification Tool)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const error =
        response.status === 404
          ? "Source not found"
          : response.status === 403
            ? "Source requires subscription"
            : `HTTP error ${response.status}`;
      return NextResponse.json({
        markdown: null,
        sourceType: "unavailable",
        error,
      });
    }

    const contentType = response.headers.get("content-type") || "";

    // Can only handle HTML/text in fallback mode
    if (!contentType.includes("text/") && !contentType.includes("html")) {
      return NextResponse.json({
        markdown: null,
        sourceType: "unavailable",
        error: "Cannot read non-text source without conversion service",
      });
    }

    const html = await response.text();
    // Basic HTML to text: strip tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return NextResponse.json({
      markdown: text,
      sourceType: "webpage",
    });
  } catch {
    return NextResponse.json({
      markdown: null,
      sourceType: "unavailable",
      error: "Failed to fetch source",
    });
  }
}
