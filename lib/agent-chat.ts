import { createRadarRun } from "./radar-runs";
import type { AgentChatMessage, InvestmentProfile, RadarRun, ResearchItem } from "./types";
import { evaluateEvidenceCoverage, evaluateMemoTrust } from "./workflows";

export function createAgentChatMessage(role: AgentChatMessage["role"], content: string, createdAt = new Date().toISOString()): AgentChatMessage {
  return {
    id: `agent-message-${role}-${Date.parse(createdAt) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt,
  };
}

function summarizeOpportunity(item: ResearchItem) {
  const coverage = evaluateEvidenceCoverage(item);
  return `${item.title}: ${item.whyNow} Sources: ${item.sources.length} (${coverage.liveSearchCount} live, ${coverage.primaryCount} primary). Open questions: ${item.openQuestions.length}.`;
}

function rankOpportunities(run?: RadarRun) {
  if (!run) return [];
  return [...run.opportunities].sort((a, b) => {
    const score = (item: ResearchItem) => {
      const coverage = evaluateEvidenceCoverage(item);
      return coverage.primaryCount * 3 + coverage.liveSearchCount + item.sources.length - item.openQuestions.length * 2 + (item.confidence === "high" ? 2 : item.confidence === "medium" ? 1 : 0);
    };
    return score(b) - score(a);
  });
}

export function answerAgentChat(input: { message: string; messages?: AgentChatMessage[]; latestRun?: RadarRun; selectedItem?: ResearchItem; profile?: InvestmentProfile }) {
  const normalized = input.message.toLowerCase();
  const latestRun = input.latestRun;
  const selectedItem = input.selectedItem;

  if (normalized.includes("which") || normalized.includes("priority") || normalized.includes("first")) {
    const ranked = rankOpportunities(latestRun);
    if (ranked.length === 0) {
      return "I do not have a saved radar run yet. Send: ‘run radar’ and I will create a live evidence scan first.";
    }
    const top = ranked[0];
    const coverage = evaluateEvidenceCoverage(top);
    return [
      `I would research first: ${top.title}.`,
      `Why: it has ${top.sources.length} source(s), including ${coverage.liveSearchCount} live and ${coverage.primaryCount} primary/official source(s), with ${top.openQuestions.length} unresolved question(s).`,
      `Next evidence work: ${top.openQuestions[0] ?? "verify primary sources and investable vehicles before any decision."}`,
      "This is a research priority, not an allocation recommendation."
    ].join("\n");
  }

  if (normalized.includes("gap") || normalized.includes("missing") || normalized.includes("blocked")) {
    const target = selectedItem ?? latestRun?.opportunities[0];
    if (!target) return "I need either a selected memo or a saved radar run before I can explain evidence gaps.";
    const trust = evaluateMemoTrust(target);
    const coverage = evaluateEvidenceCoverage(target);
    return [
      `Evidence gaps for ${target.title}:`,
      `- ${coverage.primaryCount} primary/official source(s), ${coverage.liveSearchCount} live source(s), ${coverage.curatedCount} curated source(s).`,
      ...trust.missingEvidence.map((item) => `- ${item}`),
      ...trust.warnings.map((item) => `- Warning: ${item}`),
      "Human review remains required before any decision."
    ].join("\n");
  }

  if (normalized.includes("promote")) {
    const ranked = rankOpportunities(latestRun);
    const target = ranked[0];
    if (!target) return "I do not have a radar opportunity to promote yet. Run radar first, then ask me to promote the strongest item.";
    return [
      `Suggested promotion: ${target.title}.`,
      "I can identify it for memo work, but the app keeps promotion as a human-confirmed action. Click ‘Promote to memo’ on the opportunity card if you approve.",
      summarizeOpportunity(target)
    ].join("\n");
  }

  if (normalized.includes("summarize") || normalized.includes("summary") || normalized.includes("changed") || normalized.includes("radar")) {
    if (!latestRun) return "No saved radar run yet. Send ‘run radar’ to create a live evidence scan.";
    return [
      `Latest radar run: ${latestRun.opportunityCount} opportunities, ${latestRun.sourceCount} sources.`,
      `Mode: ${latestRun.mode}. Live sources: ${latestRun.liveSourceCount}. Primary/official sources: ${latestRun.primarySourceCount}. Evidence gaps: ${latestRun.evidenceGapCount}.`,
      latestRun.changes.newOpportunities.length > 0 ? `New opportunities: ${latestRun.changes.newOpportunities.join(", ")}.` : "No new opportunity titles versus the previous run.",
      `Top item: ${latestRun.opportunities[0] ? summarizeOpportunity(latestRun.opportunities[0]) : "none"}`,
      "Research support only. No trade or allocation is authorized."
    ].join("\n");
  }

  if (selectedItem) {
    const trust = evaluateMemoTrust(selectedItem);
    return [
      `On ${selectedItem.title}: trust score is ${trust.score}/100 and decision-ready is ${trust.decisionReady ? "yes" : "no"}.`,
      trust.missingEvidence[0] ? `Most important blocker: ${trust.missingEvidence[0]}` : "No major missing-evidence blocker detected, but human review is still required.",
      "Ask me ‘what evidence is missing?’ or ‘which should I research first?’ for a more specific next step."
    ].join("\n");
  }

  return "I can help with radar scans, evidence gaps, research priority, and memo promotion suggestions. Try: ‘run radar’, ‘what changed?’, or ‘which should I research first?’";
}

export function summarizeRunForChat(run: RadarRun) {
  return [
    `Radar scan saved: ${run.opportunityCount} opportunities, ${run.sourceCount} sources.`,
    `Mode: ${run.mode}. Live sources: ${run.liveSourceCount}. Primary/official sources: ${run.primarySourceCount}. Evidence gaps: ${run.evidenceGapCount}.`,
    run.changes.newOpportunities.length > 0 ? `New opportunities: ${run.changes.newOpportunities.join(", ")}.` : "No new opportunity titles versus the previous run.",
    "Ask a follow-up like ‘which should I research first?’ or ‘what evidence is missing?’"
  ].join("\n");
}

export { createRadarRun };
