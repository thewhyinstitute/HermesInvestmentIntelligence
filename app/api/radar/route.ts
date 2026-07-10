import { NextResponse } from "next/server";
import { buildFallbackRadarOpportunities, buildRadarSearchQueries, mergeRadarEvidence } from "@/lib/radar-agent";
import { defaultProfile } from "@/lib/sample-data";
import type { EvidenceSource, InvestmentProfile, ResearchItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

async function tavilySearch(query: string): Promise<EvidenceSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: 3
    })
  });

  if (!response.ok) return [];
  const payload = await response.json() as { results?: TavilyResult[] };
  return (payload.results ?? [])
    .filter((result) => result.title && result.url)
    .map((result, index) => ({
      id: `tavily-${Date.now()}-${index}`,
      title: result.title ?? "Radar evidence",
      url: result.url ?? "",
      sourceType: "analysis" as const,
      checkedAt: new Date().toISOString().slice(0, 10),
      quality: (result.score && result.score > 0.7 ? "high" : "medium") as EvidenceSource["quality"],
      claim: result.content ? result.content.slice(0, 240) : "External search result surfaced for human verification."
    }));
}

function attachSearchEvidence(opportunities: ResearchItem[], searchEvidence: EvidenceSource[][]) {
  return opportunities.map((item, index) => ({
    ...item,
    sources: mergeRadarEvidence(item.sources, searchEvidence[index] ?? []),
  }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { profile?: InvestmentProfile } | InvestmentProfile;
  const profile = "profile" in body && body.profile ? body.profile : ("riskLevel" in body ? body as InvestmentProfile : defaultProfile);

  const opportunities = buildFallbackRadarOpportunities(profile);
  const queries = buildRadarSearchQueries(profile);
  const searchEvidence = await Promise.all(queries.map((query) => tavilySearch(query)));
  const enriched = attachSearchEvidence(opportunities, searchEvidence);
  const usedLiveSearch = searchEvidence.some((items) => items.length > 0);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mode: usedLiveSearch ? "live-search-plus-curated-fallback" : "curated-fallback",
    disclaimer: "Research support only. These are opportunities for review, not recommendations or trade instructions.",
    opportunities: enriched
  });
}
