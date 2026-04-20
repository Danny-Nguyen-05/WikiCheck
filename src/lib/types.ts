export type Verdict = "supported" | "partial" | "unsupported" | "unverifiable";

export interface CitationResult {
  id: string;
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
  /** Plain-text intro excerpt from the article (up to ~400 chars) */
  extract?: string;
}


export interface Citation {
  id: string;
  number: number;
  claim: string;
  sourceUrl: string;
  refName?: string;
  pageRange?: string;
}
