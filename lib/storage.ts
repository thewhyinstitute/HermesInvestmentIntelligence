import { defaultSyncState, sampleAgentInbox, sampleRadarSignals } from "./sample-data";
import type { AgentDraft, AgentResearchRequest, CloudSyncState, DecisionSnapshot, FrontierRadarSignal, InvestmentAppState, InvestmentProfile, RadarRun, RadarRunChangeSummary, ResearchItem } from "./types";

export const INVESTMENT_STORAGE_KEY = "hermes-investment-intelligence:v2";
export const LEGACY_INVESTMENT_STORAGE_KEY = "hermes-investment-intelligence:v1";
export const INVESTMENT_SCHEMA_VERSION = 2 as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isInvestmentProfile(value: unknown): value is InvestmentProfile {
  if (!isRecord(value)) return false;
  return isString(value.riskLevel)
    && isString(value.horizon)
    && isString(value.liquidityNeed)
    && isStringArray(value.preferredAssets)
    && isString(value.excludedAssets)
    && isString(value.geography)
    && isString(value.notes);
}

function isEvidenceSource(value: unknown) {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.title)
    && isString(value.url)
    && isString(value.sourceType)
    && isString(value.checkedAt)
    && isString(value.quality)
    && isString(value.claim);
}

function isAgentDraft(value: unknown): value is AgentDraft {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.createdAt)
    && isString(value.channel)
    && isString(value.status)
    && isString(value.request)
    && isStringArray(value.facts)
    && isStringArray(value.assumptions)
    && isStringArray(value.risks)
    && isString(value.suggestedNextStep)
    && typeof value.humanReviewRequired === "boolean";
}

function isDecisionSnapshot(value: unknown): value is DecisionSnapshot {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.createdAt)
    && isString(value.researchItemId)
    && isString(value.title)
    && isString(value.decision)
    && isString(value.confidence)
    && isString(value.thesis)
    && isStringArray(value.riskSummary)
    && typeof value.evidenceCount === "number"
    && isString(value.humanRationale)
    && isString(value.actionBoundary);
}

function isResearchItem(value: unknown): value is ResearchItem {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.title)
    && isString(value.assetClass)
    && isString(value.theme)
    && isString(value.status)
    && isString(value.whyNow)
    && isString(value.thesis)
    && isStringArray(value.assumptions)
    && isStringArray(value.openQuestions)
    && isStringArray(value.risks)
    && isString(value.fitNotes)
    && isString(value.decision)
    && isString(value.confidence)
    && isString(value.targetAllocation)
    && isString(value.reviewCadence)
    && isString(value.nextReviewAt)
    && isString(value.createdAt)
    && Array.isArray(value.sources)
    && value.sources.every(isEvidenceSource)
    && Array.isArray(value.agentDrafts)
    && value.agentDrafts.every(isAgentDraft)
    && Array.isArray(value.decisionSnapshots)
    && value.decisionSnapshots.every(isDecisionSnapshot);
}

function isAgentResearchRequest(value: unknown): value is AgentResearchRequest {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.createdAt)
    && isString(value.channel)
    && isString(value.rawRequest)
    && isString(value.parsedIntent)
    && isString(value.linkedResearchItemId)
    && isString(value.status)
    && isString(value.approvalNote);
}

function isRadarSignal(value: unknown): value is FrontierRadarSignal {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.theme)
    && isString(value.signal)
    && isString(value.sourceHint)
    && isString(value.urgency)
    && isString(value.portfolioRelevance)
    && isString(value.nextAction)
    && isString(value.lastReviewedAt);
}

function isRadarRunChangeSummary(value: unknown): value is RadarRunChangeSummary {
  if (!isRecord(value)) return false;
  return isStringArray(value.newOpportunities)
    && isStringArray(value.repeatedOpportunities)
    && isStringArray(value.newSourceUrls)
    && isStringArray(value.removedSourceUrls)
    && isStringArray(value.improvedEvidenceTitles)
    && isStringArray(value.worsenedEvidenceTitles);
}

function isRadarRun(value: unknown): value is RadarRun {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.generatedAt)
    && isString(value.mode)
    && typeof value.opportunityCount === "number"
    && typeof value.sourceCount === "number"
    && typeof value.liveSourceCount === "number"
    && typeof value.primarySourceCount === "number"
    && typeof value.evidenceGapCount === "number"
    && Array.isArray(value.opportunities)
    && value.opportunities.every(isResearchItem)
    && isRadarRunChangeSummary(value.changes);
}

function isSyncState(value: unknown): value is CloudSyncState {
  if (!isRecord(value)) return false;
  return isString(value.mode)
    && isString(value.provider)
    && isString(value.workspaceId)
    && isString(value.lastSyncStatus)
    && isString(value.lastExportedAt);
}

function normalizeResearchItem(item: ResearchItem): ResearchItem {
  return {
    ...item,
    assumptions: item.assumptions ?? [],
    openQuestions: item.openQuestions ?? [],
    targetAllocation: item.targetAllocation ?? "Research only; no allocation proposed.",
    reviewCadence: item.reviewCadence ?? "Manual review",
    nextReviewAt: item.nextReviewAt ?? "",
    agentDrafts: item.agentDrafts ?? [],
    decisionSnapshots: item.decisionSnapshots ?? [],
  };
}

export function migrateLegacyState(value: unknown): InvestmentAppState | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;
  if (!isInvestmentProfile(value.profile)) return null;
  if (!Array.isArray(value.researchItems)) return null;
  const migratedItems = value.researchItems.map((candidate): ResearchItem | null => {
    if (!isRecord(candidate)) return null;
    if (!Array.isArray(candidate.sources) || !candidate.sources.every(isEvidenceSource)) return null;
    if (!isStringArray(candidate.risks)) return null;
    if (!isString(candidate.id) || !isString(candidate.title) || !isString(candidate.assetClass) || !isString(candidate.theme)) return null;
    if (!isString(candidate.status) || !isString(candidate.whyNow) || !isString(candidate.thesis) || !isString(candidate.fitNotes)) return null;
    if (!isString(candidate.decision) || !isString(candidate.confidence) || !isString(candidate.createdAt)) return null;
    return normalizeResearchItem({
      id: candidate.id,
      title: candidate.title,
      assetClass: candidate.assetClass,
      theme: candidate.theme,
      status: candidate.status as ResearchItem["status"],
      whyNow: candidate.whyNow,
      thesis: candidate.thesis,
      assumptions: [],
      openQuestions: [],
      risks: candidate.risks,
      fitNotes: candidate.fitNotes,
      decision: candidate.decision as ResearchItem["decision"],
      confidence: candidate.confidence as ResearchItem["confidence"],
      targetAllocation: "Research only; no allocation proposed.",
      reviewCadence: "Manual review",
      nextReviewAt: "",
      createdAt: candidate.createdAt,
      sources: candidate.sources as ResearchItem["sources"],
      agentDrafts: [],
      decisionSnapshots: [],
    });
  });
  if (migratedItems.some((item) => item === null)) return null;

  return {
    schemaVersion: INVESTMENT_SCHEMA_VERSION,
    profile: value.profile,
    researchItems: migratedItems as ResearchItem[],
    selectedResearchId: isString(value.selectedResearchId) ? value.selectedResearchId : (migratedItems[0]?.id ?? ""),
    agentInbox: sampleAgentInbox,
    radarSignals: sampleRadarSignals,
    radarRuns: [],
    sync: defaultSyncState,
    lastSavedAt: isString(value.lastSavedAt) ? value.lastSavedAt : new Date().toISOString(),
  };
}

export function createInitialInvestmentState(profile: InvestmentProfile, researchItems: ResearchItem[]): InvestmentAppState {
  return {
    schemaVersion: INVESTMENT_SCHEMA_VERSION,
    profile,
    researchItems: researchItems.map(normalizeResearchItem),
    selectedResearchId: researchItems[0]?.id ?? "",
    agentInbox: sampleAgentInbox,
    radarSignals: sampleRadarSignals,
    radarRuns: [],
    sync: defaultSyncState,
    lastSavedAt: new Date().toISOString(),
  };
}

export function updateStateMetadata(state: InvestmentAppState, lastSavedAt = new Date().toISOString()): InvestmentAppState {
  return {
    ...state,
    sync: {
      ...state.sync,
      lastExportedAt: lastSavedAt,
    },
    lastSavedAt,
  };
}

export function serializeInvestmentState(state: InvestmentAppState) {
  return JSON.stringify(state);
}

export function deserializeInvestmentState(raw: string | null): InvestmentAppState | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (value.schemaVersion === 1) return migrateLegacyState(value);
    if (value.schemaVersion !== INVESTMENT_SCHEMA_VERSION) return null;
    if (!isInvestmentProfile(value.profile)) return null;
    if (!Array.isArray(value.researchItems) || !value.researchItems.every(isResearchItem)) return null;
    if (!isString(value.selectedResearchId)) return null;
    if (!Array.isArray(value.agentInbox) || !value.agentInbox.every(isAgentResearchRequest)) return null;
    if (!Array.isArray(value.radarSignals) || !value.radarSignals.every(isRadarSignal)) return null;
    if (value.radarRuns !== undefined && (!Array.isArray(value.radarRuns) || !value.radarRuns.every(isRadarRun))) return null;
    if (!isSyncState(value.sync)) return null;
    if (!isString(value.lastSavedAt)) return null;

    return {
      schemaVersion: INVESTMENT_SCHEMA_VERSION,
      profile: value.profile,
      researchItems: value.researchItems,
      selectedResearchId: value.selectedResearchId,
      agentInbox: value.agentInbox,
      radarSignals: value.radarSignals,
      radarRuns: Array.isArray(value.radarRuns) ? value.radarRuns : [],
      sync: value.sync,
      lastSavedAt: value.lastSavedAt,
    };
  } catch {
    return null;
  }
}
