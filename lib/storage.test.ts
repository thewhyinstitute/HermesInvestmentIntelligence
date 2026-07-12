import { describe, expect, it } from "vitest";
import { defaultProfile, sampleResearchItems } from "./sample-data";
import {
  createInitialInvestmentState,
  deserializeInvestmentState,
  INVESTMENT_SCHEMA_VERSION,
  migrateLegacyState,
  serializeInvestmentState,
  updateStateMetadata,
} from "./storage";
import type { InvestmentAppState } from "./types";

const legacyState = {
  schemaVersion: 1,
  profile: defaultProfile,
  researchItems: sampleResearchItems.map((item) => ({
    id: item.id,
    title: item.title,
    assetClass: item.assetClass,
    theme: item.theme,
    status: item.status,
    whyNow: item.whyNow,
    thesis: item.thesis,
    risks: item.risks,
    fitNotes: item.fitNotes,
    decision: item.decision,
    confidence: item.confidence,
    createdAt: item.createdAt,
    sources: item.sources,
  })),
  selectedResearchId: sampleResearchItems[0].id,
  lastSavedAt: "2026-07-09T12:00:00.000Z",
};

describe("investment state persistence", () => {
  it("creates a versioned cloud-ready state from the default profile and research items", () => {
    const state = createInitialInvestmentState(defaultProfile, sampleResearchItems);

    expect(state.schemaVersion).toBe(INVESTMENT_SCHEMA_VERSION);
    expect(state.profile).toEqual(defaultProfile);
    expect(state.researchItems).toEqual(sampleResearchItems);
    expect(state.selectedResearchId).toBe(sampleResearchItems[0].id);
    expect(state.agentInbox.length).toBeGreaterThan(0);
    expect(state.radarSignals.length).toBeGreaterThan(0);
    expect(state.radarRuns).toEqual([]);
    expect(state.agentMessages).toEqual([]);
    expect(state.sync.mode).toBe("cloud_ready");
    expect(state.lastSavedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("round-trips valid phase 3 state through JSON serialization", () => {
    const state = createInitialInvestmentState(defaultProfile, sampleResearchItems);
    const serialized = serializeInvestmentState(state);
    const parsed = deserializeInvestmentState(serialized);

    expect(parsed).toEqual(state);
  });

  it("migrates valid phase 2 browser-local state into phase 3 schema", () => {
    const migrated = migrateLegacyState(legacyState);

    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.researchItems[0].assumptions).toEqual([]);
    expect(migrated?.researchItems[0].agentDrafts).toEqual([]);
    expect(migrated?.radarRuns).toEqual([]);
    expect(migrated?.agentMessages).toEqual([]);
    expect(migrated?.sync.provider).toBe("supabase_ready");
  });

  it("rejects malformed or unsupported stored state", () => {
    expect(deserializeInvestmentState("not-json")).toBeNull();
    expect(deserializeInvestmentState(JSON.stringify({ schemaVersion: 999 }))).toBeNull();
    expect(deserializeInvestmentState(JSON.stringify({ schemaVersion: 2, profile: defaultProfile }))).toBeNull();
  });

  it("keeps data while refreshing persistence metadata", () => {
    const state: InvestmentAppState = createInitialInvestmentState(defaultProfile, sampleResearchItems);
    const updated = updateStateMetadata(state, "2026-07-09T12:00:00.000Z");

    expect(updated.profile).toEqual(state.profile);
    expect(updated.researchItems).toEqual(state.researchItems);
    expect(updated.lastSavedAt).toBe("2026-07-09T12:00:00.000Z");
    expect(updated.sync.lastExportedAt).toBe("2026-07-09T12:00:00.000Z");
  });
});
