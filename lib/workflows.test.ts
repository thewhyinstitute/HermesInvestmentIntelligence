import { describe, expect, it } from "vitest";
import { defaultProfile, sampleAgentInbox, sampleResearchItems } from "./sample-data";
import { createAgentDraftFromRequest, createDecisionSnapshot, createRadarSignal, createResearchRequest, createStructuredMemoDraft, evaluateEvidenceCoverage, evaluateMemoTrust, reviewEvidenceSource, scorePortfolioFit } from "./workflows";

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

  it("flags memos as not decision-ready when evidence is missing or placeholder", () => {
    const trust = evaluateMemoTrust(sampleResearchItems[0]);

    expect(trust.decisionReady).toBe(false);
    expect(trust.warnings).toContain("Replace placeholder source URLs with real primary or high-quality sources.");
    expect(trust.missingEvidence).toContain("Resolve open questions before decision capture.");
    expect(trust.label).toBe("Needs evidence");
  });

  it("marks a sourced memo ready only when sources, risks, and questions are clean", () => {
    const item = {
      ...sampleResearchItems[0],
      openQuestions: [],
      risks: ["Valuation risk", "Concentration risk"],
      sources: [
        { ...sampleResearchItems[0].sources[0], url: "https://issuer.example/factsheet.pdf" },
        { ...sampleResearchItems[0].sources[0], id: "src-2", sourceType: "filing" as const, url: "https://issuer.example/annual-report.pdf" }
      ]
    };

    const trust = evaluateMemoTrust(item);

    expect(trust.decisionReady).toBe(true);
    expect(trust.score).toBeGreaterThanOrEqual(80);
    expect(trust.label).toBe("Decision-ready draft");
  });

  it("reviews live-search evidence as discovery until primary sources confirm it", () => {
    const review = reviewEvidenceSource({
      id: "tavily-1",
      title: "Market commentary",
      url: "https://example-research.com/ai-grid",
      sourceType: "analysis",
      checkedAt: "2026-07-12",
      quality: "medium",
      claim: "Search result says AI grid demand may rise."
    });

    expect(review.origin).toBe("Live search");
    expect(review.isPrimary).toBe(false);
    expect(review.warnings).toContain("Live search result — verify facts against a primary or official source.");
  });

  it("summarizes evidence gaps without letting live links inflate readiness", () => {
    const item = {
      ...sampleResearchItems[0],
      openQuestions: [],
      risks: ["Valuation risk", "Concentration risk"],
      sources: [
        {
          id: "tavily-1",
          title: "AI infrastructure article",
          url: "https://research.example.org/ai-infra",
          sourceType: "analysis" as const,
          checkedAt: "2026-07-12",
          quality: "medium" as const,
          claim: "A live search lead for the theme."
        },
        {
          id: "tavily-2",
          title: "Second article",
          url: "https://media.example.org/grid",
          sourceType: "news" as const,
          checkedAt: "2026-07-12",
          quality: "medium" as const,
          claim: "Another live search lead."
        }
      ]
    };

    const coverage = evaluateEvidenceCoverage(item);
    const trust = evaluateMemoTrust(item);

    expect(coverage.liveSearchCount).toBe(2);
    expect(coverage.primaryCount).toBe(0);
    expect(coverage.gaps).toContain("Add at least one primary or official source: issuer, filing, regulator, or market-data evidence.");
    expect(trust.decisionReady).toBe(false);
    expect(trust.missingEvidence).toContain("Confirm live-search leads against at least one primary or official source.");
  });

  it("creates a structured memo draft from a raw research idea", () => {
    const draft = createStructuredMemoDraft("Singapore REIT recovery basket", "Rates / income", "REIT", "Rates may fall and refinancing pressure may ease");

    expect(draft.status).toBe("memo");
    expect(draft.thesis).toContain("Singapore REIT recovery basket");
    expect(draft.openQuestions).toContain("Which evidence would disconfirm this thesis?");
    expect(draft.risks).toContain("Evidence gap");
    expect(draft.targetAllocation).toContain("Research only");
  });
});
