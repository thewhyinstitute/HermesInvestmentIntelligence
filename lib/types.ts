export type RiskLevel = "low" | "moderate" | "balanced" | "high" | "barbell";
export type Horizon = "0-1y" | "1-3y" | "3-7y" | "7y+";
export type ResearchStatus = "inbox" | "watch" | "memo" | "decided" | "rejected";
export type Decision = "watch" | "research_deeper" | "exploratory_allocation" | "avoid";
export type SourceType = "issuer" | "filing" | "market_data" | "news" | "analysis" | "regulator" | "other";
export type EvidenceQuality = "high" | "medium" | "low";
export type Confidence = "low" | "medium" | "high";
export type RequestChannel = "web" | "telegram" | "hermes" | "manual_import";
export type AgentDraftStatus = "draft" | "reviewed" | "accepted" | "rejected";
export type SyncMode = "browser_local" | "cloud_ready" | "cloud_connected";

export interface InvestmentProfile {
  holdingsReviewedAt?: string;
  holdingsNotes?: string;
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
  sourceType: SourceType;
  checkedAt: string;
  quality: EvidenceQuality;
  claim: string;
}

export interface AgentDraft {
  id: string;
  createdAt: string;
  channel: RequestChannel;
  status: AgentDraftStatus;
  request: string;
  facts: string[];
  assumptions: string[];
  risks: string[];
  suggestedNextStep: string;
  humanReviewRequired: boolean;
}

export interface DecisionSnapshot {
  recommendation?: InvestmentRecommendation;
  id: string;
  createdAt: string;
  researchItemId: string;
  title: string;
  decision: Decision;
  confidence: Confidence;
  thesis: string;
  riskSummary: string[];
  evidenceCount: number;
  humanRationale: string;
  actionBoundary: string;
}

export interface ResearchItem {
  briefAssumptions?: BriefAssumptions;
  briefHistory?: DecisionBriefSnapshot[];
  recommendation?: InvestmentRecommendation;
  id: string;
  title: string;
  assetClass: string;
  theme: string;
  status: ResearchStatus;
  whyNow: string;
  thesis: string;
  assumptions: string[];
  openQuestions: string[];
  risks: string[];
  fitNotes: string;
  decision: Decision;
  confidence: Confidence;
  targetAllocation: string;
  reviewCadence: string;
  nextReviewAt: string;
  createdAt: string;
  sources: EvidenceSource[];
  agentDrafts: AgentDraft[];
  decisionSnapshots: DecisionSnapshot[];
}

export interface BriefAssumptions {
  entryPrice?: number;
  years: number;
  annualCash: number;
  bearPrice?: number;
  basePrice?: number;
  bullPrice?: number;
  requiredAnnualReturn?: number;
  maxBearLoss?: number;
}

export interface DecisionBriefSnapshot {
  id: string;
  capturedAt: string;
  symbol: string;
  conclusion: string;
  reasons: string[];
  gaps: string[];
  facts: string[];
  assumptions: BriefAssumptions;
  recommendation: InvestmentRecommendation;
  thesis: string;
  risks: string[];
  sources: EvidenceSource[];
  marketData?: import("./market-data").MarketResponse;
}

export type InvestmentStance = "consider_buying" | "accumulate" | "wait" | "watch" | "avoid";

export interface InvestmentRecommendation {
  symbol: string;
  venue: string;
  currency: string;
  stance: InvestmentStance;
  rationale: string;
  valuation: string;
  entryCondition: string;
  thesisBreakers: string[];
  alternatives: string[];
  reviewedAt?: string;
  quote?: { price: number; asOf: string; sourceUrl: string };
}

export interface AgentResearchRequest {
  id: string;
  createdAt: string;
  channel: RequestChannel;
  rawRequest: string;
  parsedIntent: string;
  linkedResearchItemId: string;
  status: "queued" | "drafted" | "reviewed";
  approvalNote: string;
}

export interface FrontierRadarSignal {
  id: string;
  theme: string;
  signal: string;
  sourceHint: string;
  urgency: "low" | "medium" | "high";
  portfolioRelevance: string;
  nextAction: string;
  lastReviewedAt: string;
}

export interface RadarRunChangeSummary {
  newOpportunities: string[];
  repeatedOpportunities: string[];
  newSourceUrls: string[];
  removedSourceUrls: string[];
  improvedEvidenceTitles: string[];
  worsenedEvidenceTitles: string[];
}

export interface RadarRun {
  id: string;
  generatedAt: string;
  mode: string;
  opportunityCount: number;
  sourceCount: number;
  liveSourceCount: number;
  primarySourceCount: number;
  evidenceGapCount: number;
  opportunities: ResearchItem[];
  changes: RadarRunChangeSummary;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}

export interface CloudSyncState {
  mode: SyncMode;
  provider: "none" | "supabase_ready" | "supabase_connected";
  workspaceId: string;
  lastSyncStatus: string;
  lastExportedAt: string;
}

export interface InvestmentAppState {
  schemaVersion: 2;
  profile: InvestmentProfile;
  researchItems: ResearchItem[];
  selectedResearchId: string;
  agentInbox: AgentResearchRequest[];
  radarSignals: FrontierRadarSignal[];
  radarRuns: RadarRun[];
  agentMessages: AgentChatMessage[];
  sync: CloudSyncState;
  lastSavedAt: string;
}
