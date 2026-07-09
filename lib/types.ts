export type RiskLevel = "low" | "medium" | "high";

export type CardKind = "decision" | "housekeeping";

export type Verdict = "approve" | "reject" | "skip";

export interface DecisionCard {
  id: string;
  kind: "decision";
  title: string;
  summary: string;
  why_it_matters: string;
  risk: RiskLevel;
  risk_reason: string;
  files: string[];
  diagram: string | null;
  patch?: string | null;
}

export interface HousekeepingCard {
  id: string;
  kind: "housekeeping";
  title?: string;
  items: string[];
}

export type ReviewCard = DecisionCard | HousekeepingCard;

export interface PRMeta {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user: string | null;
  base: string;
  head: string;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface PRResponse {
  pr: PRMeta;
  cards: ReviewCard[];
  cached?: boolean;
}

export interface CardVerdict {
  cardId: string;
  verdict: Verdict;
  comment?: string;
}

export interface CommentRequest {
  transcript: string;
  cardTitle?: string;
}

export interface CommentResponse {
  comment: string;
}

export interface ReviewRequest {
  prNumber: number;
  verdicts: CardVerdict[];
  body?: string;
}

export interface ReviewResponse {
  html_url: string;
  event: "COMMENT" | "REQUEST_CHANGES";
  id: number;
}

export interface ApiError {
  error: string;
}
