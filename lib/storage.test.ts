import { describe, expect, it } from "vitest";
import { defaultProfile, sampleResearchItems } from "./sample-data";
import {
  createInitialInvestmentState,
  deserializeInvestmentState,
  serializeInvestmentState,
  updateStateMetadata,
} from "./storage";
import type { InvestmentAppState } from "./types";

describe("investment state persistence", () => {
  it("creates a versioned initial state from the default profile and research items", () => {
    const state = createInitialInvestmentState(defaultProfile, sampleResearchItems);

    expect(state.schemaVersion).toBe(1);
    expect(state.profile).toEqual(defaultProfile);
    expect(state.researchItems).toEqual(sampleResearchItems);
    expect(state.selectedResearchId).toBe(sampleResearchItems[0].id);
    expect(state.lastSavedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("round-trips valid state through JSON serialization", () => {
    const state = createInitialInvestmentState(defaultProfile, sampleResearchItems);
    const serialized = serializeInvestmentState(state);
    const parsed = deserializeInvestmentState(serialized);

    expect(parsed).toEqual(state);
  });

  it("rejects malformed or unsupported stored state", () => {
    expect(deserializeInvestmentState("not-json")).toBeNull();
    expect(deserializeInvestmentState(JSON.stringify({ schemaVersion: 999 }))).toBeNull();
    expect(deserializeInvestmentState(JSON.stringify({ schemaVersion: 1, profile: defaultProfile }))).toBeNull();
  });

  it("keeps data while refreshing persistence metadata", () => {
    const state: InvestmentAppState = createInitialInvestmentState(defaultProfile, sampleResearchItems);
    const updated = updateStateMetadata(state, "2026-07-09T12:00:00.000Z");

    expect(updated.profile).toEqual(state.profile);
    expect(updated.researchItems).toEqual(state.researchItems);
    expect(updated.lastSavedAt).toBe("2026-07-09T12:00:00.000Z");
  });
});
