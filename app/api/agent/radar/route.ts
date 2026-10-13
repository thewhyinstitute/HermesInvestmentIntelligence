import { NextResponse } from "next/server";
import { createRadarRun } from "@/lib/radar-runs";
import { mergeRadarEvidence } from "@/lib/radar-agent";
import { buildInvestmentCandidates, investmentSearchQuery } from "@/lib/investment-candidates";
import { defaultProfile } from "@/lib/sample-data";
import type { EvidenceSource, InvestmentProfile, RadarRun, ResearchItem } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

function classifySearchResult(url: string): Pick<EvidenceSource, "sourceType" | "quality"> {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return { sourceType: "other", quality: "low" };
  }

  if (hostname.includes("sec.gov") || hostname.includes("mas.gov.sg") || hostname.includes("treasury.gov")) return { sourceType: "regulator", quality: "high" };
  if (hostname.includes("iea.org") || hostname.includes("worldbank.org") || hostname.includes("imf.org") || hostname.includes("oecd.org")) return { sourceType: "analysis", quality: "high" };
  if (hostname.includes("ishares.com") || hostname.includes("vanguard") || hostname.includes("spdr") || hostname.includes("blackrock")) return { sourceType: "issuer", quality: "high" };
  if (hostname.includes("bloomberg") || hostname.includes("reuters") || hostname.includes("ft.com") || hostname.includes("wsj.com")) return { sourceType: "news", quality: "medium" };
  return { sourceType: "analysis", quality: "medium" };
}

async function tavilySearch(query: string): Promise<EvidenceSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", include_answer: false, include_raw_content: false, max_results: 3 })
  });

  if (!response.ok) return [];
  const payload = await response.json() as { results?: TavilyResult[] };
  return (payload.results ?? [])
    .filter((result) => result.title && result.url)
    .map((result, index) => {
      const classification = classifySearchResult(result.url ?? "");
      return {
        id: `tavily-${Date.now()}-${index}`,
        title: result.title ?? "Radar evidence",
        url: result.url ?? "",
        sourceType: classification.sourceType,
        checkedAt: new Date().toISOString().slice(0, 10),
        quality: result.score && result.score > 0.75 ? "high" : classification.quality,
        claim: result.content ? result.content.slice(0, 240) : "External search result surfaced for human verification."
      };
    });
}

function attachSearchEvidence(opportunities: ResearchItem[], searchEvidence: EvidenceSource[][]) {
  return opportunities.map((item, index) => ({ ...item, sources: mergeRadarEvidence(item.sources, searchEvidence[index] ?? []) }));
}

function authorize(request: Request) {
  const configured = process.env.INVESTMENT_AGENT_API_KEY;
  if (!configured) return true;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${configured}`;
}

function agentSummary(run: RadarRun) {
  return [
    `Radar scan saved: ${run.opportunityCount} opportunities, ${run.sourceCount} sources.`,
    `Mode: ${run.mode}. Live sources: ${run.liveSourceCount}. Primary/official sources: ${run.primarySourceCount}. Evidence gaps: ${run.evidenceGapCount}.`,
    run.changes.newOpportunities.length > 0 ? `New opportunities: ${run.changes.newOpportunities.join(", ")}.` : "No new opportunity titles versus the provided previous run.",
    "Research support only. Human review required; no trade or allocation authorized."
  ].join("\n");
}

export async function POST(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { profile?: InvestmentProfile; previousRun?: RadarRun; command?: string };
  const profile = body.profile ?? defaultProfile;
  const opportunities = buildInvestmentCandidates(profile, body.command);
  const queries = opportunities.map(investmentSearchQuery);
  const searchEvidence = await Promise.all(queries.map((query) => tavilySearch(query).catch(() => [])));
  const enriched = attachSearchEvidence(opportunities, searchEvidence);
  const usedLiveSearch = searchEvidence.some((items) => items.length > 0);
  const run = createRadarRun({ mode: usedLiveSearch ? "live-search-plus-curated-fallback" : "curated-fallback", opportunities: enriched, previousRun: body.previousRun });

  return NextResponse.json({
    agent: "investment-intelligence-radar",
    telegramReady: true,
    action: "radar_scan",
    command: body.command?.trim() || "Run radar and summarize what changed.",
    run,
    suggestedReply: agentSummary(run),
    disclaimer: "Research support only. These are opportunities for review, not recommendations or trade instructions."
  });
}
