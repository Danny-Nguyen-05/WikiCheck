export interface Citation {
  id: string;
  number: number;
  claim: string;
  sourceSentence?: string;
  sourceUrl: string;
  pageRange?: string;
}

/**
 * Parse Wikipedia HTML to extract citations with their claims and source URLs.
 * This looks directly at the rendered HTML to extract identical numbers, URLs, and text
 * to exactly match the visual appearance of the page.
 */
export function parseCitations(html: string): Citation[] {
  // Step 1: Parse the references lists (e.g. <ol class="references">)
  // to find mapping from "cite_note-X" to its external URL.
  // Note: Wikipedia often HTML entity-encodes underscores in IDs like cite&#95;note instead of cite_note
  const listItemsRegex = /<li\s+id="(cite(?:_|&#95;)note-[^"]*)"[^>]*>([\s\S]*?)<\/li>/gis;
  const parsedSourcesById = new Map<string, { url: string; pageRange?: string }>();
  let match: RegExpExecArray | null;

  while ((match = listItemsRegex.exec(html)) !== null) {
    const liId = match[1].replace(/&#95;/g, "_");
    const liContent = match[2];

    // Find the first external link inside this reference item
    // Wikipedia typically uses class="external text" or similar for external URLs
    const linkMatch = liContent.match(/<a[^>]*class="[^"]*external[^"]*"[^>]*href="([^"]+)"/i);
    
    if (linkMatch) {
      const url = linkMatch[1].replace(/&amp;/g, "&");
      if (isValidUrl(url)) {
        // Extract page range from liContent by temporarily stripping tags/entities
        const tempClean = liContent.replace(/<[^>]+>/g, "").replace(/&#?\w+;/g, " ");
        // Regex specifically hunts for common page annotations: p., pp., page, pages, pg, pgs.
        const pageMatch = tempClean.match(/\b(?:p\.|pp\.|pages?|pgs?\.?)\s*([\d\-\u2013]+)/i);
        let pageRange: string | undefined;
        if (pageMatch) {
          pageRange = pageMatch[1].replace(/\u2013/g, "-").trim();
        }
        
        parsedSourcesById.set(liId, { url, pageRange });
      }
    }
  }

  // Step 2: Find all occurrences of superscript markers in the text
  // e.g. <sup id="cite&#95;ref-1" class="reference"><a href="#cite_note-1"><span>&#91;</span>1<span>&#93;</span></a></sup>
  const supRegex = /<sup[^>]*class="reference"[^>]*>.*?<a[^>]*href="#(cite_note-[^"]+)"[^>]*>(.*?)<\/a>.*?<\/sup>/gis;

  const citations: Citation[] = [];
  const seenKeys = new Set<string>();

  while ((match = supRegex.exec(html)) !== null) {
    const supStart = match.index;
    const citeNoteId = match[1];
    
    // Clean up the inner HTML of the link to get the exact text shown to the user
    // This resolves issues with entities like &#91; showing up as '91'
    const linkInnerHtml = match[2];
    const linkText = linkInnerHtml.replace(/<[^>]+>/g, "").replace(/&#91;/g, "[").replace(/&#93;/g, "]");
    const numMatch = linkText.match(/\d+/);
    if (!numMatch) continue;
    
    const visibleNumber = parseInt(numMatch[0], 10);
    const citeRefId = `${citeNoteId}-${visibleNumber}`; // fallback ID

    const sourceInfo = parsedSourcesById.get(citeNoteId);
    if (!sourceInfo) continue;

    // Deduplicate by citation number so we strictly mirror the unique references on Wikipedia
    const key = `ref-number-${visibleNumber}`;
    if (seenKeys.has(key)) continue;

    const extracted = extractClaimHTML(html, supStart);
    if (!extracted) continue;
    const { claim, sourceSentence } = extracted;

    // Skip claims that don't look like sentences
    if (looksLikeMarkup(claim)) continue;

    seenKeys.add(key);

    citations.push({
      id: citeRefId,
      number: visibleNumber,
      claim,
      sourceSentence,
      sourceUrl: sourceInfo.url,
      pageRange: sourceInfo.pageRange,
    });
  }

  // Sort citations by their visible number to match Wikipedia's reference list
  return citations.sort((a, b) => a.number - b.number);
}

/**
 * Extract the claim sentence and full source sentence that appear immediately
 * before a <sup class="reference"> tag.
 * Returns { claim: lastSentenceOnly, sourceSentence: fullCleanedBlock } or null.
 */
function extractClaimHTML(html: string, index: number): { claim: string; sourceSentence: string } | null {
  // Look back up to 800 characters to find the preceding text
  const lookback = Math.max(0, index - 800);
  let textBefore = html.substring(lookback, index);

  // If we arbitrarily cut a tag in half, discard the broken partial tag at the start
  const firstClose = textBefore.indexOf(">");
  const firstOpen = textBefore.indexOf("<");
  if (firstClose !== -1 && (firstOpen === -1 || firstClose < firstOpen)) {
    textBefore = textBefore.substring(firstClose + 1);
  }

  // We don't want to cross paragraph or block boundaries, so we split and take the very last block chunk
  const blocks = textBefore.split(/<\/?(?:p|div|h[1-6]|ul|ol|li|table|tr|td|th)[^>]*>/i);
  textBefore = blocks[blocks.length - 1];

  // Decode common HTML entities that Wikipedia uses heavily
  let clean = textBefore
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/&#8211;|&ndash;/g, "-")
    .replace(/&#8212;|&mdash;/g, "--")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // Remove all HTML tags to get pure display text
  clean = clean.replace(/<[^>]+>/g, "");

  // Remove exiting bracketed inline citations like [1] or [note 1]
  clean = clean.replace(/\[(?:note\s*)?\d+[a-z]*\]/gi, "");
  
  // Clean up remaining generic entities
  clean = clean.replace(/&#?\w+;/g, "");

  // Clean up whitespace
  clean = clean.replace(/\s+/g, " ").trim();

  // `clean` is now the full block text — use it as sourceSentence.
  // Then split into sentences and take the last one as the claim.
  const sourceSentence = clean;

  // Extract the last sentence using period/exclamation/question marks as delimiters
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const lastSentence = sentences[sentences.length - 1]?.trim();

  // Validate the extracted sentence
  if (!lastSentence || lastSentence.length < 15) {
    // Fallback: just give the last chunks of characters if punctuation parsing fails
    const fallback = clean.slice(-200).trim();
    if (fallback.length < 15) return null;
    return { claim: fallback, sourceSentence };
  }

  return { claim: lastSentence, sourceSentence };
}

/**
 * Validation to skip claims that are just stray formatting or math formulas.
 */
function looksLikeMarkup(claim: string): boolean {
  // Contains braces
  if (/\{\{|\}\}/.test(claim)) return true;
  // Almost entirely non-alphabetic
  const alphaRatio = (claim.match(/[a-zA-Z]/g) || []).length / claim.length;
  if (alphaRatio < 0.4) return true;

  return false;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
