export type RiskLevel = "low" | "moderate" | "balanced" | "high" | "barbell";
export type Horizon = "0-1y" | "1-3y" | "3-7y" | "7y+";
export type ResearchStatus = "inbox" | "watch" | "memo" | "decided" | "rejected";
export type Decision = "watch" | "research_deeper" | "exploratory_allocation" | "avoid";

export interface InvestmentProfile {
  riskLevel: RiskLevel;
  horizon: Horizon;
  liquidityNeed: string;
  preferredAssets: string[];
  excludedAssets: string;
  geography: string;
  notes: string;
}

export interface EvidenceSource {
  id: string;
  title: string;
  url: string;
  sourceType: "issuer" | "filing" | "market_data" | "news" | "analysis" | "regulator" | "other";
  checkedAt: string;
  quality: "high" | "medium" | "low";
  claim: string;
}

export interface ResearchItem {
  id: string;
  title: string;
  assetClass: string;
  theme: string;
  status: ResearchStatus;
  whyNow: string;
  thesis: string;
  risks: string[];
  fitNotes: string;
  decision: Decision;
  confidence: "low" | "medium" | "high";
  createdAt: string;
  sources: EvidenceSource[];
}

export interface InvestmentAppState {
  schemaVersion: 1;
  profile: InvestmentProfile;
  researchItems: ResearchItem[];
  selectedResearchId: string;
  lastSavedAt: string;
}
