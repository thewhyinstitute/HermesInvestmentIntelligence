import { describe, expect, it } from "vitest";
import { defaultProfile } from "./sample-data";
import { buildInvestmentCandidates } from "./investment-candidates";
import { profileFitReason, profileIsComplete, profilePriorityAdjustment } from "./profile-guidance";
import { createInitialInvestmentState, deserializeInvestmentState, serializeInvestmentState } from "./storage";

const profile = { ...defaultProfile, goal: "growth" as const, investmentBudget: 10000, baseCurrency: "USD", experience: "some" as const, profileCompletedAt: "2026-10-14" };
const items = buildInvestmentCandidates(profile);
const item = (symbol: string) => items.find(x => x.recommendation?.symbol === symbol)!;
describe("personal investment guidance", () => {
  it("does not mistake demo defaults for a completed profile", () => {
    expect(profileIsComplete(defaultProfile)).toBe(false);
    expect(profileFitReason(item("NVDA"), defaultProfile)).toContain("Complete your profile");
    expect(profileIsComplete(profile)).toBe(true);
  });
  it("distinguishes capital preservation from equity growth", () => {
    const conservative = { ...profile, goal: "preserve_capital" as const };
    expect(profilePriorityAdjustment(item("SGOV"), conservative)).toBeGreaterThan(profilePriorityAdjustment(item("NVDA"), conservative));
    expect(profileFitReason(item("NVDA"), conservative)).toContain("too volatile");
  });
  it("flags short horizons, gold income and currency risk", () => {
    expect(profileFitReason(item("QQQM"), { ...profile, horizon: "0-1y" })).toContain("within one year");
    expect(profileFitReason(item("IAU"), { ...profile, goal: "income" })).toContain("does not generate");
    expect(profileFitReason(item("SGOV"), { ...profile, baseCurrency: "SGD" })).toContain("currency risk");
  });
  it("preserves new fields and existing research across browser backups", () => {
    const state = createInitialInvestmentState(profile, items);
    expect(deserializeInvestmentState(serializeInvestmentState(state))).toEqual(state);
    state.profile.investmentBudget = -1;
    expect(deserializeInvestmentState(serializeInvestmentState(state))).toBeNull();
  });
});
