import { describe, expect, it } from "vitest";
import { answerAgentChat, createAgentChatMessage } from "./agent-chat";
import { createRadarRun } from "./radar-runs";
import { buildFallbackRadarOpportunities } from "./radar-agent";
import { defaultProfile } from "./sample-data";

const run = createRadarRun({ mode: "curated-fallback", opportunities: buildFallbackRadarOpportunities(defaultProfile) });

describe("agent chat", () => {
  it("creates persistable chat messages", () => {
    const message = createAgentChatMessage("user", "Which should I research first?", "2026-07-12T00:00:00.000Z");
    expect(message.role).toBe("user");
    expect(message.content).toContain("research first");
    expect(message.createdAt).toBe("2026-07-12T00:00:00.000Z");
  });

  it("answers follow-up priority questions from the latest radar run", () => {
    const answer = answerAgentChat({ message: "Which one should I research first?", latestRun: run, profile: defaultProfile });
    expect(answer).toContain("I would research first");
    expect(answer).toContain("research priority");
  });

  it("answers evidence gap questions about selected memo", () => {
    const answer = answerAgentChat({ message: "What evidence is missing?", latestRun: run, selectedItem: run.opportunities[0], profile: defaultProfile });
    expect(answer).toContain("Evidence gaps");
    expect(answer).toContain("Human review remains required");
  });
});
