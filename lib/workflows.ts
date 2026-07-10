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

export function createStructuredMemoDraft(title: string, theme: string, assetClass: string, whyNow: string): ResearchItem {
  const cleanedTitle = title.trim() || "Untitled research idea";
  const cleanedTheme = theme.trim() || "Unclassified theme";
  const cleanedAssetClass = assetClass.trim() || "Unknown";
  const cleanedWhyNow = whyNow.trim() || "Timing signal needs to be clarified with evidence.";

  return {
    id: `research-${Date.now()}`,
    title: cleanedTitle,
    assetClass: cleanedAssetClass,
    theme: cleanedTheme,
    status: "memo",
    whyNow: cleanedWhyNow,
    thesis: `${cleanedTitle} may be worth researching because ${cleanedWhyNow.toLowerCase()}. Treat this as a draft thesis until source evidence confirms or challenges it.`,
    assumptions: [
      "The timing signal is material rather than noise.",
      "There is an investable vehicle that maps cleanly to the theme.",
      "The opportunity can fit the portfolio without creating excessive concentration or liquidity risk."
    ],
    openQuestions: [
      "Which primary or high-quality sources support this thesis?",
      "Which evidence would disconfirm this thesis?",
      "How does this affect concentration, liquidity, currency exposure, and downside risk?"
    ],
    risks: ["Evidence gap", "Valuation or timing risk", "Portfolio concentration risk"],
    fitNotes: "Fit is provisional. Validate against risk level, time horizon, liquidity needs, geography, and excluded assets.",
    decision: "research_deeper",
    confidence: "low",
    targetAllocation: "Research only; no allocation proposed.",
    reviewCadence: "Manual review after evidence is attached",
    nextReviewAt: today(),
    createdAt: today(),
    sources: [],
    agentDrafts: [],
    decisionSnapshots: []
  };
}

export function evaluateMemoTrust(item: ResearchItem) {
  const missingEvidence: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  const placeholderSources = item.sources.filter((source) => source.url.includes("example.com") || source.url.includes("replace-with"));
  const highQualitySources = item.sources.filter((source) => source.quality === "high" || source.sourceType === "issuer" || source.sourceType === "filing" || source.sourceType === "regulator");

  if (item.sources.length === 0) {
    score -= 35;
    missingEvidence.push("Attach at least two sources before decision capture.");
  } else if (item.sources.length === 1) {
    score -= 15;
    missingEvidence.push("Add a second independent source before decision capture.");
  }

  if (placeholderSources.length > 0) {
    score -= 25;
    warnings.push("Replace placeholder source URLs with real primary or high-quality sources.");
  }

  if (highQualitySources.length === 0) {
    score -= 15;
    missingEvidence.push("Add at least one primary/high-quality source such as issuer, filing, regulator, or market-data evidence.");
  }

  if (item.openQuestions.length > 0) {
    score -= Math.min(25, item.openQuestions.length * 8);
    missingEvidence.push("Resolve open questions before decision capture.");
  }

  if (item.risks.length < 2) {
    score -= 12;
    warnings.push("Document at least two concrete risks before trusting this memo.");
  }

  if (!item.thesis.trim() || item.thesis.toLowerCase().includes("pending")) {
    score -= 12;
    warnings.push("Replace placeholder thesis with a clear, falsifiable thesis.");
  }

  const bounded = Math.max(0, Math.min(100, score));
  const decisionReady = bounded >= 80 && missingEvidence.length === 0 && warnings.length === 0;

  return {
    score: bounded,
    label: decisionReady ? "Decision-ready draft" : bounded >= 60 ? "Review required" : "Needs evidence",
    decisionReady,
    missingEvidence,
    warnings,
    requiredNextStep: decisionReady ? "Human can capture a decision snapshot if rationale is clear." : (missingEvidence[0] || warnings[0] || "Review memo quality before decision capture."),
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
