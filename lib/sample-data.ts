import type { InvestmentProfile, ResearchItem } from "./types";

export const defaultProfile: InvestmentProfile = {
  riskLevel: "balanced",
  horizon: "3-7y",
  liquidityNeed: "Keep enough liquidity for personal runway and optionality; avoid locking too much capital early.",
  preferredAssets: ["Global ETFs", "AI infrastructure", "Gold", "High-quality bonds", "Selective crypto"],
  excludedAssets: "No leveraged products, no opaque yield schemes, no trade execution without explicit approval.",
  geography: "Global-first with interest in US, Singapore, and Asia opportunities.",
  notes: "Research should be evidence-backed, practical, and framed as decision support, not financial advice."
};

export const sampleResearchItems: ResearchItem[] = [
  {
    id: "ai-infra-etfs",
    title: "AI infrastructure ETF basket",
    assetClass: "ETF",
    theme: "AI infrastructure",
    status: "watch",
    whyNow: "AI capex, data center buildout, semiconductors, power demand, and enterprise AI adoption are creating a multi-year investment theme.",
    thesis: "A diversified basket may reduce single-stock execution risk while preserving exposure to compute, networking, and infrastructure beneficiaries.",
    risks: ["Valuation risk after strong AI-related performance", "Concentration risk inside thematic ETFs", "Cyclicality in semiconductors", "Theme crowding"],
    fitNotes: "Potentially aligned with Idris' AI/product interests, but needs concentration checks against existing tech exposure.",
    decision: "research_deeper",
    confidence: "medium",
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
    ]
  },
  {
    id: "gold-portfolio-hedge",
    title: "Gold as portfolio hedge",
    assetClass: "Commodity / ETF",
    theme: "Defensive allocation",
    status: "inbox",
    whyNow: "Gold can be relevant when real rates, currency risk, geopolitics, or portfolio drawdown protection are under review.",
    thesis: "A small allocation can diversify equity-heavy exposure, but opportunity cost and vehicle choice matter.",
    risks: ["No cash flow", "Real-rate sensitivity", "Currency effects", "Storage/fund structure costs"],
    fitNotes: "May fit as a stabilizer depending on current portfolio concentration and liquidity needs.",
    decision: "watch",
    confidence: "medium",
    createdAt: "2026-07-09",
    sources: []
  },
  {
    id: "short-duration-bonds",
    title: "Short-duration bond / T-bill ladder",
    assetClass: "Bonds / Cash-like",
    theme: "Capital preservation",
    status: "memo",
    whyNow: "Useful for capital preservation, liquidity planning, and reducing all-equity risk while rates remain relevant.",
    thesis: "Short-duration instruments may provide yield with lower duration risk than long bonds.",
    risks: ["Reinvestment risk", "Currency mismatch", "Inflation risk", "Platform/product fees"],
    fitNotes: "Strong fit for capital that should not be exposed to high volatility.",
    decision: "research_deeper",
    confidence: "high",
    createdAt: "2026-07-09",
    sources: []
  }
];
