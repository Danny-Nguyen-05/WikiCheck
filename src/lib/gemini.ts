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

export async function verifyCitation(
  claim: string,
  sourceText: string,
  model: string = "gemini-3-flash-preview"
): Promise<VerificationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Truncate source text to 6000 chars to stay within token limits
  const truncatedSource =
    sourceText.length > 6000 ? sourceText.substring(0, 6000) + "\n...[truncated]" : sourceText;

  const prompt = `Claim from Wikipedia article:\n"${claim}"\n\nSource text:\n"${truncatedSource}"`;

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
      const escalated = await verifyCitation(claim, sourceText, "gemini-3-flash-preview");
      return escalated;
    } catch {
      // If escalation fails, return the original result
      return result;
    }
  }

  return result;
}
