import { describe, expect, it } from "vitest";
import { defaultProfile, sampleAgentInbox, sampleResearchItems } from "./sample-data";
import { createAgentDraftFromRequest, createDecisionSnapshot, createRadarSignal, createResearchRequest, scorePortfolioFit } from "./workflows";

describe("investment workflow helpers", () => {
  it("creates queued agent research requests with approval boundaries", () => {
    const request = createResearchRequest("Check AI power infrastructure ETFs", "ai-infra-etfs");

    expect(request.status).toBe("queued");
    expect(request.linkedResearchItemId).toBe("ai-infra-etfs");
    expect(request.approvalNote).toContain("No trade");
  });

  it("turns an agent request into a human-reviewed draft", () => {
    const draft = createAgentDraftFromRequest(sampleAgentInbox[0], sampleResearchItems[0]);

    expect(draft.status).toBe("draft");
    expect(draft.humanReviewRequired).toBe(true);
    expect(draft.suggestedNextStep).toContain("Review evidence quality");
  });

  it("scores portfolio fit without producing trade instructions", () => {
    const fit = scorePortfolioFit(sampleResearchItems[0], defaultProfile);

    expect(fit.score).toBeGreaterThan(0);
    expect(fit.nextCheck).toContain("before any action");
  });

  it("captures immutable decision snapshot boundaries", () => {
    const snapshot = createDecisionSnapshot(sampleResearchItems[0], "Good research candidate, but not ready for allocation.");

    expect(snapshot.researchItemId).toBe(sampleResearchItems[0].id);
    expect(snapshot.actionBoundary).toContain("not a trade instruction");
  });

  it("creates frontier radar signals for later promotion", () => {
    const signal = createRadarSignal("Edge AI", "AI PCs may shift inference workloads to device edge.");

    expect(signal.theme).toBe("Edge AI");
    expect(signal.nextAction).toContain("Research Inbox");
  });
});
