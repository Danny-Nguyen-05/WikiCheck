import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    // ── Step 1: opensearch for titles + descriptions + urls ──────────────────
    const wikiUrl = new URL("https://en.wikipedia.org/w/api.php");
    wikiUrl.searchParams.set("action", "opensearch");
    wikiUrl.searchParams.set("search", query);
    wikiUrl.searchParams.set("limit", "8");
    wikiUrl.searchParams.set("format", "json");
    wikiUrl.searchParams.set("origin", "*");

    const response = await fetch(wikiUrl.toString(), {
      headers: { "User-Agent": "WikiCheck/1.0 (Citation Verification Tool)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { results: [], error: "Wikipedia API error" },
        { status: 502 }
      );
    }

    // Wikipedia opensearch returns: [query, [titles], [descriptions], [urls]]
    const data = await response.json();
    const titles: string[] = data[1] || [];
    const descriptions: string[] = data[2] || [];
    const urls: string[] = data[3] || [];

    if (titles.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // ── Step 2: batch-fetch plain-text intro extracts for all titles ──────────
    const extractUrl = new URL("https://en.wikipedia.org/w/api.php");
    extractUrl.searchParams.set("action", "query");
    extractUrl.searchParams.set("titles", titles.join("|"));
    extractUrl.searchParams.set("prop", "extracts");
    extractUrl.searchParams.set("exintro", "1");       // intro section only
    extractUrl.searchParams.set("explaintext", "1");   // plain text, no HTML
    extractUrl.searchParams.set("exchars", "500");     // max 500 chars each
    extractUrl.searchParams.set("format", "json");
    extractUrl.searchParams.set("origin", "*");

    const extractResp = await fetch(extractUrl.toString(), {
      headers: { "User-Agent": "WikiCheck/1.0 (Citation Verification Tool)" },
      signal: AbortSignal.timeout(10000),
    });

    // Build a map: normalised title → extract string
    const extractMap: Record<string, string> = {};
    if (extractResp.ok) {
      const extractData = await extractResp.json();
      const pages: Record<string, { title: string; extract?: string }> =
        extractData?.query?.pages || {};
      for (const page of Object.values(pages)) {
        if (page.title && page.extract) {
          // Trim leading whitespace / newlines the API sometimes adds
          extractMap[page.title] = page.extract.trim();
        }
      }
    }

    // ── Step 3: merge ────────────────────────────────────────────────────────
    const results = titles.map((title, i) => ({
      title,
      description: descriptions[i] || "",
      url: urls[i] || "",
      extract: extractMap[title] || undefined,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { results: [], error: "Failed to search Wikipedia" },
      { status: 500 }
    );
  }
}

