import type { AgentDraft, AgentResearchRequest, DecisionSnapshot, InvestmentProfile, ResearchItem } from "./types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function now() {
  return new Date().toISOString();
}

export function createResearchRequest(rawRequest: string, linkedResearchItemId = ""): AgentResearchRequest {
  const cleaned = rawRequest.trim();
  return {
    id: `request-${Date.now()}`,
    createdAt: now(),
    channel: "web",
    rawRequest: cleaned,
    parsedIntent: cleaned ? `Prepare a reviewed research draft for: ${cleaned}` : "Prepare a reviewed research draft for the selected opportunity.",
    linkedResearchItemId,
    status: "queued",
    approvalNote: "Drafting only. No trade, external message, account action, or capital commitment is authorized."
  };
}

export function createAgentDraftFromRequest(request: AgentResearchRequest, item: ResearchItem): AgentDraft {
  return {
    id: `draft-${Date.now()}`,
    createdAt: now(),
    channel: request.channel,
    status: "draft",
    request: request.rawRequest,
    facts: [
      `${item.sources.length} source(s) are currently attached to this opportunity.`,
      `Lifecycle status is ${item.status}; decision option is ${item.decision}.`
    ],
    assumptions: item.assumptions.length > 0 ? item.assumptions : ["The opportunity still needs source-backed assumptions before decision."],
    risks: item.risks.length > 0 ? item.risks : ["Risks are not yet documented."],
    suggestedNextStep: item.sources.length === 0
      ? "Attach at least two primary or high-quality sources before accepting this memo draft."
      : "Review evidence quality, fill open questions, then create a decision snapshot if the memo is ready.",
    humanReviewRequired: true
  };
}

export function scorePortfolioFit(item: ResearchItem, profile: InvestmentProfile) {
  let score = 55;
  const lowerAsset = item.assetClass.toLowerCase();
  const lowerTheme = item.theme.toLowerCase();
  const preferredMatch = profile.preferredAssets.some((asset) => lowerAsset.includes(asset.toLowerCase()) || lowerTheme.includes(asset.toLowerCase()));
  const excludedMatch = profile.excludedAssets.toLowerCase().split(/[,.;]/).some((term) => term.trim().length > 3 && (lowerAsset.includes(term.trim()) || lowerTheme.includes(term.trim())));
  if (preferredMatch) score += 15;
  if (item.sources.length >= 2) score += 10;
  if (item.confidence === "high") score += 10;
  if (item.confidence === "low") score -= 10;
  if (item.risks.length > 3) score -= 5;
  if (profile.riskLevel === "low" && ["crypto", "private", "crowdfunding"].some((term) => lowerAsset.includes(term))) score -= 25;
  if (excludedMatch) score -= 30;
  const bounded = Math.max(0, Math.min(100, score));
  return {
    score: bounded,
    label: bounded >= 75 ? "Strong research fit" : bounded >= 55 ? "Review fit" : "Weak fit until clarified",
    blockers: [
      item.sources.length === 0 ? "No evidence attached" : "",
      item.openQuestions.length > 0 ? `${item.openQuestions.length} open question(s)` : "",
      excludedMatch ? "Potential exclusion conflict" : ""
    ].filter(Boolean),
    nextCheck: "Validate concentration, liquidity, currency exposure, fees, and downside scenario before any action."
  };
}

export function createDecisionSnapshot(item: ResearchItem, humanRationale: string): DecisionSnapshot {
  return {
    id: `decision-${Date.now()}`,
    createdAt: now(),
    researchItemId: item.id,
    title: item.title,
    decision: item.decision,
    confidence: item.confidence,
    thesis: item.thesis,
    riskSummary: item.risks,
    evidenceCount: item.sources.length,
    humanRationale: humanRationale.trim() || "Snapshot captured for accountability; rationale to be expanded by Idris before acting.",
    actionBoundary: "Research record only. This is not a trade instruction and does not authorize external action or capital deployment."
  };
}

export function createRadarSignal(theme: string, signal: string) {
  return {
    id: `radar-${Date.now()}`,
    theme: theme.trim() || "Unclassified theme",
    signal: signal.trim() || "Signal needs review.",
    sourceHint: "Add primary sources, market data, regulator/fund documents, or high-quality analysis before relying on this signal.",
    urgency: "medium" as const,
    portfolioRelevance: "Needs fit check against risk level, time horizon, liquidity, and concentration.",
    nextAction: "Promote to Research Inbox only after evidence is attached.",
    lastReviewedAt: today()
  };
}
