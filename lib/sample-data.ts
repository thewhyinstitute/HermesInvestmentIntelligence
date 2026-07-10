import type { AgentResearchRequest, CloudSyncState, FrontierRadarSignal, InvestmentProfile, ResearchItem } from "./types";

export const defaultProfile: InvestmentProfile = {
  riskLevel: "balanced",
  horizon: "3-7y",
  liquidityNeed: "Keep enough liquidity for personal runway and optionality; avoid locking too much capital early.",
  preferredAssets: ["Global ETFs", "AI infrastructure", "Gold", "High-quality bonds", "Selective crypto"],
  excludedAssets: "No leveraged products, no opaque yield schemes, no trade execution without explicit approval.",
  geography: "Global-first with interest in US, Singapore, and Asia opportunities.",
  notes: "Research should be evidence-backed, practical, and framed as decision support, not financial advice."
};

export const defaultSyncState: CloudSyncState = {
  mode: "cloud_ready",
  provider: "supabase_ready",
  workspaceId: "idris-investment-research-os",
  lastSyncStatus: "Cloud schema contract prepared locally. No Supabase project or credentials connected yet.",
  lastExportedAt: ""
};

export const sampleAgentInbox: AgentResearchRequest[] = [
  {
    id: "agent-request-ai-infra",
    createdAt: "2026-07-10T00:00:00.000Z",
    channel: "hermes",
    rawRequest: "Research AI infrastructure ETFs for evidence, risks, and fit with my profile.",
    parsedIntent: "Prepare an evidence-backed memo draft for the AI infrastructure ETF basket.",
    linkedResearchItemId: "ai-infra-etfs",
    status: "drafted",
    approvalNote: "Draft only. Human review required before any decision or external action."
  }
];

export const sampleRadarSignals: FrontierRadarSignal[] = [
  {
    id: "radar-ai-power",
    theme: "AI infrastructure",
    signal: "AI data center buildout may shift bottlenecks from compute to power, cooling, networking, and grid capacity.",
    sourceHint: "Track issuer factsheets, hyperscaler capex commentary, utility/grid reports, and semiconductor cycle data.",
    urgency: "high",
    portfolioRelevance: "Relevant to Idris' AI thesis, but concentration and valuation risk need a guardrail.",
    nextAction: "Compare broad AI infrastructure ETFs against direct semiconductor/platform exposure before adding anything.",
    lastReviewedAt: "2026-07-10"
  },
  {
    id: "radar-cash-yield",
    theme: "Capital preservation",
    signal: "Short-duration yield remains useful as a liquidity and optionality sleeve while volatile themes are researched.",
    sourceHint: "Track T-bill yields, money market fund factsheets, FX exposure, and platform fees.",
    urgency: "medium",
    portfolioRelevance: "Supports runway and downside management without forcing risk-on deployment.",
    nextAction: "Document liquidity needs and currency constraints before comparing products.",
    lastReviewedAt: "2026-07-10"
  }
];

export const sampleResearchItems: ResearchItem[] = [
  {
    id: "ai-infra-etfs",
    title: "AI infrastructure ETF basket",
    assetClass: "ETF",
    theme: "AI infrastructure",
    status: "watch",
    whyNow: "AI capex, data center buildout, semiconductors, power demand, and enterprise AI adoption are creating a multi-year investment theme.",
    thesis: "A diversified basket may reduce single-stock execution risk while preserving exposure to compute, networking, and infrastructure beneficiaries.",
    assumptions: ["AI infrastructure spend remains durable beyond the current hype cycle", "ETF holdings provide diversified exposure rather than hidden single-stock concentration"],
    openQuestions: ["Which ETFs have acceptable fees and transparent holdings?", "How much current portfolio exposure already overlaps with mega-cap tech and semiconductors?"],
    risks: ["Valuation risk after strong AI-related performance", "Concentration risk inside thematic ETFs", "Cyclicality in semiconductors", "Theme crowding"],
    fitNotes: "Potentially aligned with Idris' AI/product interests, but needs concentration checks against existing tech exposure.",
    decision: "research_deeper",
    confidence: "medium",
    targetAllocation: "Research only; no allocation proposed.",
    reviewCadence: "Monthly while theme remains active",
    nextReviewAt: "2026-08-10",
    createdAt: "2026-07-09",
    sources: [
      {
        id: "src-ai-1",
        title: "Issuer factsheets for candidate AI infrastructure ETFs",
        url: "https://example.com/replace-with-issuer-factsheet",
        sourceType: "issuer",
        checkedAt: "2026-07-09",
        quality: "high",
        claim: "ETF holdings and fees must come from issuer factsheets before any memo is finalized."
      }
    ],
    agentDrafts: [
      {
        id: "draft-ai-1",
        createdAt: "2026-07-10T00:00:00.000Z",
        channel: "hermes",
        status: "draft",
        request: "Research AI infrastructure ETFs for evidence, risks, and fit with my profile.",
        facts: ["Issuer holdings, fees, and index rules must be verified from source documents."],
        assumptions: ["A basket approach may reduce individual company execution risk."],
        risks: ["Thematic ETF overlap and valuation risk can be material."],
        suggestedNextStep: "Collect 3 issuer factsheets and compare top-10 holdings overlap before memo acceptance.",
        humanReviewRequired: true
      }
    ],
    decisionSnapshots: []
  },
  {
    id: "gold-portfolio-hedge",
    title: "Gold as portfolio hedge",
    assetClass: "Commodity / ETF",
    theme: "Defensive allocation",
    status: "inbox",
    whyNow: "Gold can be relevant when real rates, currency risk, geopolitics, or portfolio drawdown protection are under review.",
    thesis: "A small allocation can diversify equity-heavy exposure, but opportunity cost and vehicle choice matter.",
    assumptions: ["The objective is diversification, not short-term speculation"],
    openQuestions: ["Physical, ETF, or fund vehicle?", "What currency exposure matters most?"],
    risks: ["No cash flow", "Real-rate sensitivity", "Currency effects", "Storage/fund structure costs"],
    fitNotes: "May fit as a stabilizer depending on current portfolio concentration and liquidity needs.",
    decision: "watch",
    confidence: "medium",
    targetAllocation: "Research only; no allocation proposed.",
    reviewCadence: "Quarterly",
    nextReviewAt: "2026-10-10",
    createdAt: "2026-07-09",
    sources: [],
    agentDrafts: [],
    decisionSnapshots: []
  },
  {
    id: "short-duration-bonds",
    title: "Short-duration bond / T-bill ladder",
    assetClass: "Bonds / Cash-like",
    theme: "Capital preservation",
    status: "memo",
    whyNow: "Useful for capital preservation, liquidity planning, and reducing all-equity risk while rates remain relevant.",
    thesis: "Short-duration instruments may provide yield with lower duration risk than long bonds.",
    assumptions: ["This sleeve protects optionality and near-term liquidity"],
    openQuestions: ["Which currency should the liquidity sleeve be held in?", "What product fees or platform spreads apply?"],
    risks: ["Reinvestment risk", "Currency mismatch", "Inflation risk", "Platform/product fees"],
    fitNotes: "Strong fit for capital that should not be exposed to high volatility.",
    decision: "research_deeper",
    confidence: "high",
    targetAllocation: "Research only; no allocation proposed.",
    reviewCadence: "Monthly until cash plan is set",
    nextReviewAt: "2026-08-10",
    createdAt: "2026-07-09",
    sources: [],
    agentDrafts: [],
    decisionSnapshots: []
  }
];
