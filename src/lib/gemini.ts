import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export interface VerificationResult {
  verdict: "supported" | "partial" | "unsupported" | "unverifiable";
  confidence: number;
  explanation: string;
  relevant_passage: string | null;
}

const SYSTEM_PROMPT = `You are a Wikipedia citation verifier. Given a Wikipedia claim and source text, determine if the source supports the claim.

Respond ONLY in this exact JSON format:
{
  "verdict": "supported" | "partial" | "unsupported" | "unverifiable",
  "confidence": 0-100,
  "explanation": "one concise sentence",
  "relevant_passage": "exact quote from source or null"
}

Verdict guidelines:
- "supported": The source clearly and directly supports the claim.
- "partial": The source partially supports the claim but with differences in details, numbers, or scope.
- "unsupported": The source contradicts the claim or does not support it.
- "unverifiable": The source text does not contain enough information to verify the claim.

Be precise. Compare specific facts, numbers, dates, and names.`;

/**
 * A lightweight RAG (Retrieval-Augmented Generation) function that locally scans 
 * the massive source document and extracts only the paragraphs most relevant to the claim.
 * This massively cuts down on AI Token costs and speeds up verification latency.
 */
function findRelevantPassages(claim: string, text: string, maxChars: number = 3000): string {
  // Extract key search terms from the claim (ignoring common stop words)
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'in', 'a', 'an', 'and', 'or', 'to', 'for', 'of', 'with', 'by', 'as', 'that', 'from']);
  const keywords = claim.toLowerCase().match(/\b(\w+)\b/g)?.filter(w => !stopWords.has(w) && w.length > 2) || [];

  if (keywords.length === 0) return text.substring(0, maxChars);

  // Split the massive text into logical paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  const scoredParagraphs = paragraphs.map(p => {
    let score = 0;
    const pLower = p.toLowerCase();

    // An exact full claim phrase match guarantees extremely high relevance
    if (pLower.includes(claim.toLowerCase())) score += 100;

    // Fuzzy keyword intersection matching
    keywords.forEach(kw => {
      if (pLower.includes(kw)) score += 1;
    });
    return { text: p, score };
  });

  // Rank paragraphs strictly by keyword density/relevance
  scoredParagraphs.sort((a, b) => b.score - a.score);

  // Concatenate the top scoring paragraphs efficiently
  let result = "";
  for (const p of scoredParagraphs) {
    if (result.length + p.text.length > maxChars) break;
    // Only include paragraphs that actually matched something
    if (p.score > 0) {
      result += p.text + "\n...\n";
    }
  }

  // Very rare fallback if nothing matched (e.g., completely irrelevant document returned)
  return result || text.substring(0, maxChars);
}

export async function verifyCitation(
  claim: string,
  sourceText: string,
  model: string = "gemini-3-flash-preview"
): Promise<VerificationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Use edge filtering RAG to drastically minimize token context and latency
  const optimizedSource = findRelevantPassages(claim, sourceText, 3000);

  const prompt = `Claim from Wikipedia article:\n"${claim}"\n\nSource text:\n"${optimizedSource}"`;

  const genModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const result = await genModel.generateContent([
    { text: SYSTEM_PROMPT },
    { text: prompt },
  ]);

  const responseText = result.response.text();

  try {
    const parsed = JSON.parse(responseText);
    return {
      verdict: parsed.verdict || "unverifiable",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      explanation: parsed.explanation || "No explanation provided",
      relevant_passage: parsed.relevant_passage || null,
    };
  } catch {
    return {
      verdict: "unverifiable",
      confidence: 0,
      explanation: "Failed to parse AI response",
      relevant_passage: null,
    };
  }
}

/**
 * Verify with escalation: use flash first, escalate to pro if confidence is low.
 */
export async function verifyCitationWithEscalation(
  claim: string,
  sourceText: string
): Promise<VerificationResult> {
  const result = await verifyCitation(claim, sourceText, "gemini-3-flash-preview");

  // Escalate to pro model if confidence is below 50%
  if (result.confidence < 50 && result.verdict !== "unverifiable") {
    try {
      const escalated = await verifyCitation(claim, sourceText, "gemini-3.1-pro-preview");
      return escalated;
    } catch {
      // If escalation fails, return the original result
      return result;
    }
  }

  return result;
}

/**
 * Verify using Google Search Grounding when the source is missing/paywalled.
 */
export async function verifyCitationWithSearch(
  claim: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<VerificationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const prompt = `The original citation link is broken or paywalled. Verify the truth of the following Wikipedia claim using your Google Search tool:\n"${claim}"`;

  // We explicitly configure the Google Search tool here
  const genModel = genAI.getGenerativeModel({
    model: modelName,
    tools: [
      {
        // @ts-ignore - The types might be slightly behind the SDK implementation
        googleSearch: {}
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1, // Keep it low for factual responses
    },
  });

  const searchSysPrompt = `You are a web-connected Wikipedia citation verifier. Use the Google Search tool to verify if the claim is true or false across the internet.

Respond ONLY in this exact JSON format:
{
  "verdict": "supported" | "partial" | "unsupported" | "unverifiable",
  "confidence": 0-100,
  "explanation": "one concise sentence explaining your search findings",
  "relevant_passage": "exact quote from the search result or null"
}

Verdict guidelines:
- "supported": Your search clearly matches and proves the claim.
- "partial": Your search partially supports the claim but with differences in details, numbers, or scope.
- "unsupported": Your search actively contradicts the claim.
- "unverifiable": You could not find enough information on Google to verify it.`;

  try {
    const result = await genModel.generateContent([
      { text: searchSysPrompt },
      { text: prompt },
    ]);

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    return {
      verdict: parsed.verdict || "unverifiable",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      explanation: parsed.explanation || "No explanation provided",
      relevant_passage: parsed.relevant_passage || null,
    };
  } catch (error) {
    return {
      verdict: "unverifiable",
      confidence: 0,
      explanation: "Failed to perform Google Search verification",
      relevant_passage: null,
    };
  }
}

/**
 * Verify by asking Gemini to read the exact citation URL directly using its urlContext tool.
 * This is more accurate than Google Search because it reads the specific cited source,
 * not just whatever Google finds.
 *
 * Works well for: public webpages, open-access articles, government sites.
 * May fail for:   PDFs (handled earlier by Python service), paywalled content.
 */
export async function verifyCitationWithUrlContext(
  claim: string,
  sourceUrl: string,
  modelName: string = "gemini-3.1-pro-preview"
): Promise<VerificationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const genModel = genAI.getGenerativeModel({
    model: modelName,
    tools: [
      {
        // @ts-ignore - urlContext tool lets Gemini fetch and read the URL directly
        urlContext: {}
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const sysPrompt = `You are a Wikipedia citation verifier. You will be given a URL and a claim.
Fetch and read the content at that URL, then determine whether the source supports the Wikipedia claim.

Respond ONLY in this exact JSON format:
{
  "verdict": "supported" | "partial" | "unsupported" | "unverifiable",
  "confidence": 0-100,
  "explanation": "one concise sentence explaining what you found at the URL",
  "relevant_passage": "exact quote from the page content or null"
}

Verdict guidelines:
- "supported": The page clearly and directly supports the claim.
- "partial": The page partially supports the claim but with differences in details, numbers, or scope.
- "unsupported": The page contradicts the claim or does not support it.
- "unverifiable": You could not access the page or it did not contain enough information.`;

  const prompt = `Please fetch and read this URL: ${sourceUrl}

Then verify the following Wikipedia claim against the content you find:
"${claim}"`;

  try {
    const result = await genModel.generateContent([
      { text: sysPrompt },
      { text: prompt },
    ]);

    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    // If Gemini reports it couldn't access the URL, treat as failure so
    // the caller can escalate to Google Search grounding.
    if (
      parsed.verdict === "unverifiable" &&
      typeof parsed.explanation === "string" &&
      (parsed.explanation.toLowerCase().includes("could not access") ||
        parsed.explanation.toLowerCase().includes("unable to fetch") ||
        parsed.explanation.toLowerCase().includes("cannot access"))
    ) {
      throw new Error("Gemini could not access the URL");
    }

    return {
      verdict: parsed.verdict || "unverifiable",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      explanation: parsed.explanation || "No explanation provided",
      relevant_passage: parsed.relevant_passage || null,
    };
  } catch {
    // Propagate failure so the caller can try the next fallback
    throw new Error("URL context verification failed");
  }
}
