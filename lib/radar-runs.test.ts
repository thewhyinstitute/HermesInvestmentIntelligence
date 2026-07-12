import { describe, expect, it } from "vitest";
import { createRadarRun, compareRadarRuns } from "./radar-runs";
import { buildFallbackRadarOpportunities } from "./radar-agent";
import { defaultProfile } from "./sample-data";

const opportunities = buildFallbackRadarOpportunities(defaultProfile);

describe("saved radar runs", () => {
  it("creates an auditable run summary with source and gap counts", () => {
    const run = createRadarRun({ mode: "curated-fallback", opportunities, generatedAt: "2026-07-12T00:00:00.000Z" });

    expect(run.id).toBe("radar-run-1783814400000");
    expect(run.opportunityCount).toBe(opportunities.length);
    expect(run.sourceCount).toBeGreaterThan(0);
    expect(run.primarySourceCount).toBeGreaterThan(0);
    expect(run.changes.newOpportunities).toContain(opportunities[0].title);
  });

  it("compares radar runs by opportunity title and source URL", () => {
    const previous = createRadarRun({ mode: "curated-fallback", opportunities: [opportunities[0]], generatedAt: "2026-07-11T00:00:00.000Z" });
    const changes = compareRadarRuns(previous, opportunities);

    expect(changes.repeatedOpportunities).toContain(opportunities[0].title);
    expect(changes.newOpportunities.length).toBeGreaterThan(0);
    expect(changes.newSourceUrls.length).toBeGreaterThan(0);
  });
});
