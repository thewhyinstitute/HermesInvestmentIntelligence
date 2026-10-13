import { describe, expect, it } from "vitest";
import { buildInvestmentCandidates, investmentSearchQuery } from "./investment-candidates";
import { defaultProfile } from "./sample-data";
import { evaluateRecommendation } from "./recommendations";
import { createDecisionSnapshot } from "./workflows";
import { answerAgentChat } from "./agent-chat";
import { createRadarRun } from "./radar-runs";

describe("specific investment candidates", () => {
  it("covers stocks, equity funds, gold and short-term bonds without fabricated prices", () => {
    const items = buildInvestmentCandidates(defaultProfile);
    expect(items.map(item => item.recommendation?.symbol)).toEqual(["QQQM", "GRID", "IAU", "SGOV", "NVDA"]);
    items.forEach(item => {
      expect(item.recommendation?.quote).toBeUndefined();
      expect(evaluateRecommendation(item, defaultProfile).stance).toBe("watch");
      expect(investmentSearchQuery(item)).toContain(item.recommendation!.symbol);
    });
  });
  it("directs scans to the requested asset class", () => {
    expect(buildInvestmentCandidates(defaultProfile, "scan gold")[0].recommendation?.symbol).toBe("IAU");
    expect(buildInvestmentCandidates(defaultProfile, "AI grid infrastructure")[0].recommendation?.symbol).toBe("GRID");
  });
  it("explains instrument stances in investment chat", () => {
    const run = createRadarRun({ mode: "curated-fallback", opportunities: buildInvestmentCandidates(defaultProfile) });
    const answer = answerAgentChat({ message: "What do you recommend I invest in?", latestRun: run, profile: defaultProfile });
    expect(answer).toContain("QQQM"); expect(answer).toContain("Why:"); expect(answer).toContain("Before acting:");
  });
  it("snapshots the investment case independently of future memo edits", () => {
    const [item] = buildInvestmentCandidates(defaultProfile);
    const snapshot = createDecisionSnapshot(item, "Keep on watch");
    item.recommendation!.thesisBreakers.push("Later change");
    expect(snapshot.recommendation?.thesisBreakers).not.toContain("Later change");
  });
});
