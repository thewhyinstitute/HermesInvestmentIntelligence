import { describe, expect, it } from "vitest";
import { buildDecisionBrief, captureDecisionBrief, compareBriefs, defaultBriefAssumptions } from "./decision-brief";
import { isBriefAssumptions } from "./brief-validation";
import { buildInvestmentCandidates } from "./investment-candidates";
import { defaultProfile } from "./sample-data";
import { createInitialInvestmentState, deserializeInvestmentState, serializeInvestmentState } from "./storage";
import type { MarketResponse } from "./market-data";

const now = new Date("2026-10-14T12:00:00Z");
const item = () => buildInvestmentCandidates(defaultProfile).find(x => x.recommendation?.symbol === "NVDA")!;
const market: MarketResponse = { configured: true, result: { symbol: "NVDA", fetchedAt: "2026-10-13T12:00:00Z", messages: [],
  quote: { price: 100, asOf: "2026-10-13", sourceUrl: "https://www.alphavantage.co/query" },
  fundamentals: { kind: "company", eps: 5, periodEnd: "2026-07-31", sourceUrl: "https://www.alphavantage.co/query", holdings: [] } } };

describe("decision briefs", () => {
  it("produces a useful incomplete brief without inventing prices or forecasts", () => {
    const brief = buildDecisionBrief(item(), defaultProfile, defaultBriefAssumptions, undefined, now);
    expect(brief.conclusion).toBe("Wait for current data");
    expect(brief.scenarios.every(s => s.returns === undefined)).toBe(true);
    expect(brief.portfolioFit).toContain("Pending your holdings");
  });
  it("compares user thresholds and never issues a buy instruction", () => {
    const brief = buildDecisionBrief(item(), defaultProfile, { years: 1, annualCash: 0, bearPrice: 50, basePrice: 105, bullPrice: 140, requiredAnnualReturn: 10, maxBearLoss: 20 }, market, now);
    expect(brief.conclusion).toBe("Wait: scenario conflicts with your limits");
    expect(brief.reasons).toContain("Your base scenario falls below your required annual return.");
    expect(brief.reasons).toContain("Your bear scenario exceeds your maximum acceptable loss.");
    expect(brief.facts.some(f => f.includes("20.0x"))).toBe(true);
  });
  it("requires ordered scenarios and handles zero terminal prices", () => {
    const assumptions = { years: 1, annualCash: 0, bearPrice: 0, basePrice: 100, bullPrice: 150 };
    expect(buildDecisionBrief(item(), defaultProfile, assumptions, market, now).scenarios[0].returns?.total).toBe(-1);
    expect(buildDecisionBrief(item(), defaultProfile, { ...assumptions, bearPrice: 120 }, market, now).scenarios[0].returns).toBeUndefined();
  });
  it("does not treat an assumed entry price as a verified current quote", () => {
    const brief = buildDecisionBrief(item(), defaultProfile, { ...defaultBriefAssumptions, entryPrice: 100, bearPrice: 80, basePrice: 120, bullPrice: 150 }, undefined, now);
    expect(brief.conclusion).toBe("Wait for current data");
    expect(brief.scenarios[1].returns).toBeDefined();
  });
  it("does not interpret USD fundamentals under a different quote currency", () => {
    const candidate = item(); candidate.recommendation!.currency = "EUR";
    const brief = buildDecisionBrief(candidate, defaultProfile, defaultBriefAssumptions, market, now);
    expect(brief.quote).toBeUndefined(); expect(brief.gaps.some(g => g.includes("currency mismatch"))).toBe(true);
  });
  it("re-evaluates saved dates and rejects invalid manual price inputs", () => {
    expect(buildDecisionBrief(item(), defaultProfile, defaultBriefAssumptions, market, new Date("2026-11-01")).conclusion).toBe("Wait for current data");
    const candidate = item(); candidate.recommendation!.quote = { price: 0, asOf: "2026-10-13", sourceUrl: "https://example.org" };
    expect(buildDecisionBrief(candidate, defaultProfile, defaultBriefAssumptions, undefined, now).conclusion).toBe("Wait for current data");
  });
  it("preserves immutable snapshots and tracks content changes regardless of evidence order", () => {
    const candidate = item(); const before = captureDecisionBrief(candidate, defaultProfile, defaultBriefAssumptions, market, now);
    candidate.thesis = "Changed thesis"; candidate.sources[0].claim = "Changed source claim";
    const changed = structuredClone(market); changed.result!.quote!.price = 120;
    const after = captureDecisionBrief(candidate, defaultProfile, { years: 4, annualCash: 0 }, changed, now);
    expect(before.thesis).not.toBe(candidate.thesis);
    const changes = compareBriefs(before, after).join(" ");
    expect(changes).toContain("20.00%"); expect(changes).toContain("Investment thesis"); expect(changes).toContain("Evidence sources"); expect(changes).toContain("scenario assumptions");
    const reordered = structuredClone(before); reordered.sources.reverse();
    expect(compareBriefs(before, reordered)).toEqual([]);
  });
  it("round-trips saved brief history while rejecting malformed imports", () => {
    const candidate = item(); candidate.briefAssumptions = { years: 3, annualCash: 0 };
    candidate.briefHistory = [captureDecisionBrief(candidate, defaultProfile, candidate.briefAssumptions, market, now)];
    const state = createInitialInvestmentState(defaultProfile, [candidate]);
    expect(deserializeInvestmentState(serializeInvestmentState(state))).toEqual(state);
    const invalid = structuredClone(state); invalid.researchItems[0].briefHistory![0].assumptions.years = -1;
    expect(deserializeInvestmentState(JSON.stringify(invalid))).toBeNull();
    const badMarket = structuredClone(state); badMarket.researchItems[0].briefHistory![0].marketData!.result!.quote!.price = -1;
    expect(deserializeInvestmentState(JSON.stringify(badMarket))).toBeNull();
  });
  it("validates numerical assumptions including missing optional targets", () => {
    expect(isBriefAssumptions(defaultBriefAssumptions)).toBe(true);
    expect(isBriefAssumptions({ years: Infinity, annualCash: 0 })).toBe(false);
    expect(isBriefAssumptions({ years: 3, annualCash: 0, maxBearLoss: 101 })).toBe(false);
    expect(() => captureDecisionBrief(item(), defaultProfile, { years: 0, annualCash: 0 }, market, now)).toThrow();
    expect(buildDecisionBrief(item(), defaultProfile, { years: 0, annualCash: 0 }, market, now).gaps).toContain("Correct the invalid numerical scenario assumptions.");
  });
});
