import type { InvestmentAppState, InvestmentProfile, ResearchItem } from "./types";

export const INVESTMENT_STORAGE_KEY = "hermes-investment-intelligence:v1";
export const INVESTMENT_SCHEMA_VERSION = 1 as const;

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

function isResearchItem(value: unknown): value is ResearchItem {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.title)
    && isString(value.assetClass)
    && isString(value.theme)
    && isString(value.status)
    && isString(value.whyNow)
    && isString(value.thesis)
    && isStringArray(value.risks)
    && isString(value.fitNotes)
    && isString(value.decision)
    && isString(value.confidence)
    && isString(value.createdAt)
    && Array.isArray(value.sources)
    && value.sources.every(isEvidenceSource);
}

export function createInitialInvestmentState(profile: InvestmentProfile, researchItems: ResearchItem[]): InvestmentAppState {
  return {
    schemaVersion: INVESTMENT_SCHEMA_VERSION,
    profile,
    researchItems,
    selectedResearchId: researchItems[0]?.id ?? "",
    lastSavedAt: new Date().toISOString(),
  };
}

export function updateStateMetadata(state: InvestmentAppState, lastSavedAt = new Date().toISOString()): InvestmentAppState {
  return {
    ...state,
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
    if (value.schemaVersion !== INVESTMENT_SCHEMA_VERSION) return null;
    if (!isInvestmentProfile(value.profile)) return null;
    if (!Array.isArray(value.researchItems) || !value.researchItems.every(isResearchItem)) return null;
    if (!isString(value.selectedResearchId)) return null;
    if (!isString(value.lastSavedAt)) return null;

    return {
      schemaVersion: INVESTMENT_SCHEMA_VERSION,
      profile: value.profile,
      researchItems: value.researchItems,
      selectedResearchId: value.selectedResearchId,
      lastSavedAt: value.lastSavedAt,
    };
  } catch {
    return null;
  }
}
