import { NextRequest, NextResponse } from "next/server";
import { parseCitations } from "@/lib/parser";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");

  if (!title) {
    return NextResponse.json(
      { error: "No title provided" },
      { status: 400 }
    );
  }

  try {
    // Fetch HTML only, wikitext is no longer needed
    const htmlResponse = await fetchArticleHtml(title);

    if (!htmlResponse.ok) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    const htmlData = await htmlResponse.json();
    const html = htmlData?.parse?.text?.["*"] || "";

    // Parse citations from rendered HTML
    const citations = parseCitations(html);

    return NextResponse.json({
      title: htmlData?.parse?.title || title,
      html,
      citations,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}

function fetchArticleHtml(title: string) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "text");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  return fetch(url.toString(), {
    headers: { "User-Agent": "WikiCheck/1.0 (Citation Verification Tool)" },
    signal: AbortSignal.timeout(15000),
  });
}


