export type Verdict = "supported" | "partial" | "unsupported" | "unverifiable";

export interface CitationResult {
  number: number;
  verdict: Verdict;
  confidence: number;
  explanation: string;
  relevant_passage: string | null;
  sourceType: string;
}

export interface SearchResult {
  title: string;
  description: string;
  url: string;
}

export interface Citation {
  number: number;
  claim: string;
  sourceUrl: string;
  refName?: string;
}
