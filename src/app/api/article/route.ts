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
    // Fetch HTML and wikitext in parallel
    const [htmlResponse, wikitextResponse] = await Promise.all([
      fetchArticleHtml(title),
      fetchArticleWikitext(title),
    ]);

    if (!htmlResponse.ok || !wikitextResponse.ok) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    const htmlData = await htmlResponse.json();
    const wikitextData = await wikitextResponse.json();

    const html = htmlData?.parse?.text?.["*"] || "";
    const wikitext = wikitextData?.parse?.wikitext?.["*"] || "";

    // Parse citations from wikitext
    const citations = parseCitations(wikitext);

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

function fetchArticleWikitext(title: string) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  return fetch(url.toString(), {
    headers: { "User-Agent": "WikiCheck/1.0 (Citation Verification Tool)" },
    signal: AbortSignal.timeout(15000),
  });
}
