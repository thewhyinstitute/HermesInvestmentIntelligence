import { describe, expect, it } from "vitest";
import { defaultProfile } from "./sample-data";
import { createStructuredMemoDraft } from "./workflows";
import { evaluateRecommendation, rankRecommendations } from "./recommendations";

const now = new Date("2026-10-13T12:00:00Z");
function readyItem() {
  const item = createStructuredMemoDraft("Test asset", "Growth", "Stock", "Verified catalyst");
  item.openQuestions = [];
  item.sources = ["issuer.example.org", "regulator.example.org"].map((host, index) => ({
    id: `verified-${index}`, title: "Verified filing", url: `https://${host}/filing`,
    sourceType: "filing" as const, quality: "high" as const, checkedAt: "2026-10-13", claim: "Instrument-specific claim verified by reviewer",
  }));
  item.recommendation = { symbol: "TEST", venue: "NASDAQ", currency: "USD", stance: "consider_buying",
    rationale: "Reviewed case", valuation: "Scenario-based comparison", entryCondition: "Within reviewed range",
    thesisBreakers: ["Margins deteriorate"], alternatives: ["Diversified fund"], reviewedAt: "2026-10-13",
    quote: { price: 100, asOf: "2026-10-13", sourceUrl: "https://issuer.example.org/quote" } };
  return item;
}
const profile = { ...defaultProfile, goal: "growth" as const, investmentBudget: 10000, baseCurrency: "USD", experience: "some" as const, profileCompletedAt: "2026-10-13", holdingsNotes: "Holdings and liquidity reviewed", holdingsReviewedAt: "2026-10-13" };
describe("investment recommendation gates", () => {
  it("does not turn a theme into a buy", () => {
    const result = evaluateRecommendation(createStructuredMemoDraft("Theme", "AI", "Theme", "Growth"), profile, now);
    expect(result.stance).toBe("watch"); expect(result.ready).toBe(false);
  });
  it("allows a reviewed concrete investment case", () => {
    expect(evaluateRecommendation(readyItem(), profile, now).stance).toBe("consider_buying");
    expect(evaluateRecommendation(readyItem(), profile, now).ready).toBe(true);
  });
  it("requires a completed personal profile before a buy stance", () => {
    expect(evaluateRecommendation(readyItem(), { ...profile, profileCompletedAt: undefined }, now).stance).toBe("wait");
  });
  it("blocks volatile investments for capital preservation", () => {
    expect(evaluateRecommendation(readyItem(), { ...profile, goal: "preserve_capital" }, now).stance).toBe("wait");
  });
  it("downgrades missing or stale price and unknown holdings to wait", () => {
    const item = readyItem(); item.recommendation!.quote!.asOf = "2026-09-01";
    const result = evaluateRecommendation(item, defaultProfile, now);
    expect(result.stance).toBe("wait"); expect(result.blockers.join(" ")).toContain("actual holdings");
  });
  it("does not count repeated domains as independent evidence", () => {
    const item = readyItem(); item.sources[1].url = item.sources[0].url + "-2";
    expect(evaluateRecommendation(item, profile, now).stance).toBe("wait");
  });
  it("keeps rejected items out of buy recommendations and dedupes symbols", () => {
    const item = readyItem(); item.status = "rejected";
    expect(evaluateRecommendation(item, profile, now).stance).toBe("avoid");
    expect(rankRecommendations([item, item], profile, now)).toHaveLength(1);
  });
  it("respects explicit excluded ticker symbols", () => {
    expect(evaluateRecommendation(readyItem(), { ...profile, excludedAssets: "TEST" }, now).stance).toBe("avoid");
  });
});
