import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const wikiUrl = new URL("https://en.wikipedia.org/w/api.php");
    wikiUrl.searchParams.set("action", "opensearch");
    wikiUrl.searchParams.set("search", query);
    wikiUrl.searchParams.set("limit", "8");
    wikiUrl.searchParams.set("format", "json");
    wikiUrl.searchParams.set("origin", "*");

    const response = await fetch(wikiUrl.toString(), {
      headers: {
        "User-Agent": "WikiCheck/1.0 (Citation Verification Tool)",
      },
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

    const results = titles.map((title, i) => ({
      title,
      description: descriptions[i] || "",
      url: urls[i] || "",
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { results: [], error: "Failed to search Wikipedia" },
      { status: 500 }
    );
  }
}
