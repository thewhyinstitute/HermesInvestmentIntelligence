import { describe, expect, it } from "vitest";
import { defaultProfile } from "./sample-data";
import { buildFallbackRadarOpportunities, buildTopicRadarOpportunities, mergeRadarEvidence } from "./radar-agent";

describe("autonomous radar agent", () => {
  it("creates evidence-backed opportunities aligned to the user profile", () => {
    const opportunities = buildFallbackRadarOpportunities(defaultProfile);

    expect(opportunities.length).toBeGreaterThanOrEqual(3);
    expect(opportunities[0].status).toBe("memo");
    expect(opportunities[0].sources.length).toBeGreaterThanOrEqual(2);
    expect(opportunities[0].confidence).toBe("medium");
    expect(opportunities[0].targetAllocation).toContain("Research only");
  });

  it("uses real non-placeholder evidence URLs", () => {
    const opportunities = buildFallbackRadarOpportunities(defaultProfile);
    const urls = opportunities.flatMap((item) => item.sources.map((source) => source.url));

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url.startsWith("https://"))).toBe(true);
    expect(urls.some((url) => url.includes("example.com"))).toBe(false);
    expect(urls.some((url) => url.includes("replace-with"))).toBe(false);
  });

  it("deduplicates radar evidence by URL while preserving source metadata", () => {
    const [item] = buildFallbackRadarOpportunities(defaultProfile);
    const merged = mergeRadarEvidence(item.sources, [item.sources[0], { ...item.sources[0], id: "duplicate" }]);

    expect(merged.length).toBe(item.sources.length);
    expect(new Set(merged.map((source) => source.url)).size).toBe(merged.length);
  });

  it("creates topic-directed AI power and grid opportunities with credible evidence", () => {
    const opportunities = buildTopicRadarOpportunities(defaultProfile, "find me opportunities to invest in AI power and grid infrastructure");

    expect(opportunities).toHaveLength(3);
    expect(opportunities[0].title).toContain("Grid equipment");
    expect(opportunities[0].confidence).toBe("high");
    expect(opportunities[0].sources.length).toBeGreaterThanOrEqual(3);
    expect(opportunities[0].sources.every((source) => source.quality === "high")).toBe(true);
    expect(opportunities.flatMap((item) => item.sources).some((source) => source.sourceType === "regulator" || source.sourceType === "market_data")).toBe(true);
  });
});
