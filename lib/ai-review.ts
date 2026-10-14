import { supportedSymbols, type MarketSymbol } from "./market-data";

export interface AIReviewInput {
  symbol: MarketSymbol;
  thesis: string;
  entryCondition: string;
  facts: string[];
  gaps: string[];
  risks: string[];
  scenarios: string[];
  sources: { id: string; title: string; url: string; claim: string }[];
}
export interface AIReview {
  summary: string;
  assessment: "research_deeper" | "wait" | "avoid";
  caseFor: string[];
  caseAgainst: string[];
  whatToVerify: string[];
  sourceIds: string[];
}
const row = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string" && value.length <= 2000;
const list = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every(text);
export function isAIReviewInput(value: unknown): value is AIReviewInput {
  return row(value) && supportedSymbols.includes(value.symbol as MarketSymbol) && text(value.thesis) && text(value.entryCondition)
    && ["facts", "gaps", "risks", "scenarios"].every(key => list(value[key]))
    && Array.isArray(value.sources) && value.sources.length <= 12 && value.sources.every(source => row(source)
      && ["id", "title", "url", "claim"].every(key => text(source[key])) && String(source.url).startsWith("https://"));
}
export function parseAIReview(value: unknown, allowedSourceIds: string[]): AIReview {
  if (!row(value) || !text(value.summary) || !["research_deeper", "wait", "avoid"].includes(String(value.assessment))
    || !["caseFor", "caseAgainst", "whatToVerify", "sourceIds"].every(key => list(value[key]))
    || !(value.sourceIds as string[]).every(id => allowedSourceIds.includes(id))) throw new Error("Invalid AI review.");
  return { summary: value.summary as string, assessment: value.assessment as AIReview["assessment"], caseFor: value.caseFor as string[],
    caseAgainst: value.caseAgainst as string[], whatToVerify: value.whatToVerify as string[], sourceIds: value.sourceIds as string[] };
}
export function reviewContext(input: AIReviewInput): AIReviewInput {
  return { symbol: input.symbol, thesis: input.thesis, entryCondition: input.entryCondition, facts: input.facts, gaps: input.gaps,
    risks: input.risks, scenarios: input.scenarios, sources: input.sources.map(source => ({ id: source.id, title: source.title, url: source.url, claim: source.claim })) };
}
const array = { type: "array", items: { type: "string" } };
export const aiReviewSchema = {
  type: "object", additionalProperties: false,
  properties: { summary: { type: "string" }, assessment: { type: "string", enum: ["research_deeper", "wait", "avoid"] },
    caseFor: array, caseAgainst: array, whatToVerify: array, sourceIds: array },
  required: ["summary", "assessment", "caseFor", "caseAgainst", "whatToVerify", "sourceIds"],
};
