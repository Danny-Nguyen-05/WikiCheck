export interface Citation {
  number: number;
  claim: string;
  sourceUrl: string;
  refName?: string;
}

/**
 * Parse Wikipedia wikitext to extract citations with their claims and source URLs.
 */
export function parseCitations(wikitext: string): Citation[] {
  // Step 0: Strip non-prose sections (infoboxes, templates, tables, categories, etc.)
  // We only want refs that appear in actual article prose.
  const proseText = extractProseText(wikitext);

  // Step 1: Build a map of named refs (name → full ref content) from the FULL wikitext
  // (definitions may be in non-prose sections but referenced in prose)
  const namedRefs = new Map<string, string>();
  const fullRefRegex = /<ref\s+name\s*=\s*["']?([^"'\s/>]+)["']?\s*>([\s\S]*?)<\/ref>/gi;
  let match: RegExpExecArray | null;

  while ((match = fullRefRegex.exec(wikitext)) !== null) {
    const name = match[1].toLowerCase();
    const content = match[2];
    if (!namedRefs.has(name)) {
      namedRefs.set(name, content);
    }
  }

  // Step 2: Find all ref occurrences in the PROSE text only
  const allRefsRegex = /<ref(?:\s+name\s*=\s*["']?([^"'\s/>]+)["']?)?\s*(?:\/?>([\s\S]*?)<\/ref>|\s*\/>)/gi;

  const citations: Citation[] = [];
  let citationNumber = 1;
  const seenKeys = new Set<string>();

  while ((match = allRefsRegex.exec(proseText)) !== null) {
    const refName = match[1]?.toLowerCase();
    const refContent = match[2] || "";
    const refStart = match.index;

    // Get the ref content — either inline or from the named refs map
    let content = refContent.trim();
    if (!content && refName && namedRefs.has(refName)) {
      content = namedRefs.get(refName)!;
    }

    if (!content) continue;

    // Extract URL from cite template
    const url = extractUrlFromCiteTemplate(content);
    if (!url) continue;

    // Extract the claim: the sentence immediately before this <ref> tag
    const claim = extractClaim(proseText, refStart);
    if (!claim) continue;

    // Skip claims that still look like raw markup (pipe-separated fields, template params)
    if (looksLikeMarkup(claim)) continue;

    // Deduplicate
    const key = `${url}|||${claim}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    citations.push({
      number: citationNumber++,
      claim,
      sourceUrl: url,
      refName: refName || undefined,
    });
  }

  return citations;
}

/**
 * Extract only the prose (paragraph) sections of wikitext,
 * stripping infoboxes, tables, categories, and other non-prose blocks.
 */
function extractProseText(wikitext: string): string {
  let text = wikitext;

  // Remove nested templates like {{Infobox ...}}, {{short description ...}}, etc.
  // Repeatedly strip innermost templates until none remain
  let prev = "";
  while (prev !== text) {
    prev = text;
    // Remove innermost templates (no nested {{ inside)
    text = text.replace(/\{\{(?:[^{}]|\n)*?\}\}/g, "");
  }

  // Remove tables {| ... |}
  text = text.replace(/\{\|[\s\S]*?\|\}/g, "");

  // Remove categories [[Category:...]]
  text = text.replace(/\[\[Category:[^\]]*\]\]/gi, "");

  // Remove file/image links [[File:...]] and [[Image:...]]
  text = text.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "");

  // Remove __TOC__, __NOTOC__, etc.
  text = text.replace(/__[A-Z]+__/g, "");

  // Remove lines that start with | or ! (table rows that survived)
  text = text.replace(/^\s*[|!].*$/gm, "");

  return text;
}

/**
 * Check if a claim string still looks like raw wikitext markup rather than prose.
 */
function looksLikeMarkup(claim: string): boolean {
  // Contains pipe-separated fields (infobox params like "| children = 3")
  if ((claim.match(/\|/g) || []).length >= 2) return true;
  // Starts with a pipe
  if (/^\s*\|/.test(claim)) return true;
  // Contains {{ or }} (unresolved templates)
  if (/\{\{|\}\}/.test(claim)) return true;
  // Contains [[ or ]] (unresolved wikilinks — more than 1)
  if ((claim.match(/\[\[/g) || []).length >= 2) return true;
  // Too short to be a real claim
  if (claim.length < 15) return true;
  // Mostly non-alphanumeric (markup noise)
  const alphaRatio = (claim.match(/[a-zA-Z]/g) || []).length / claim.length;
  if (alphaRatio < 0.4) return true;

  return false;
}

/**
 * Extract URL from a Wikipedia cite template.
 */
function extractUrlFromCiteTemplate(content: string): string | null {
  // Try |url= parameter first (most common)
  const urlParamMatch = content.match(/\|\s*url\s*=\s*([^\s|}\]]+)/i);
  if (urlParamMatch) {
    let url = urlParamMatch[1].trim();
    url = url.replace(/[{}[\]]+$/, "");
    if (isValidUrl(url)) return url;
  }

  // Try bare URL in the ref content
  const bareUrlMatch = content.match(/(https?:\/\/[^\s|}\]<>]+)/i);
  if (bareUrlMatch) {
    let url = bareUrlMatch[1].trim();
    url = url.replace(/[{}[\]]+$/, "");
    if (isValidUrl(url)) return url;
  }

  return null;
}

/**
 * Extract the claim sentence that appears immediately before a <ref> tag.
 */
function extractClaim(wikitext: string, refIndex: number): string {
  // Get text before the ref tag (up to 500 chars back)
  const lookback = Math.max(0, refIndex - 500);
  const textBefore = wikitext.substring(lookback, refIndex);

  // Remove wikitext markup
  const clean = textBefore
    // Remove any remaining templates
    .replace(/\{\{[^{}]*\}\}/g, "")
    // Remove wiki links, keep display text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    // Remove external links, keep display text
    .replace(/\[https?:\/\/[^\s\]]+ ([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]]+\]/g, "")
    // Remove HTML tags
    .replace(/<[^>]+>/g, "")
    // Remove ref tags that might be inline
    .replace(/<ref[^>]*\/>/g, "")
    // Remove section headings (== Title ==)
    .replace(/^=+\s*.*?\s*=+$/gm, "")
    // Remove bold/italic markup
    .replace(/'{2,5}/g, "")
    // Remove pipe characters (table/template leftovers)
    .replace(/\|/g, " ")
    // Clean up whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Extract the last sentence
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const lastSentence = sentences[sentences.length - 1]?.trim();

  if (!lastSentence || lastSentence.length < 15) {
    // If no good sentence, take last 200 chars as fallback
    const fallback = clean.slice(-200).trim();
    if (fallback.length < 15) return "";
    return fallback;
  }

  return lastSentence;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
