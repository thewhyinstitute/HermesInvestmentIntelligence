import { NextResponse } from "next/server";
import { answerAgentChat, createAgentChatMessage, summarizeRunForChat } from "@/lib/agent-chat";
import { createRadarRun } from "@/lib/radar-runs";
import { mergeRadarEvidence } from "@/lib/radar-agent";
import { buildInvestmentCandidates, investmentSearchQuery } from "@/lib/investment-candidates";
import { defaultProfile } from "@/lib/sample-data";
import type { AgentChatMessage, EvidenceSource, InvestmentProfile, RadarRun, ResearchItem } from "@/lib/types";

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

async function runRadar(profile: InvestmentProfile, previousRun?: RadarRun, prompt = "") {
  const opportunities = buildInvestmentCandidates(profile, prompt);
  const queries = opportunities.map(investmentSearchQuery);
  const searchEvidence = await Promise.all(queries.map((query) => tavilySearch(query).catch(() => [])));
  const enriched = attachSearchEvidence(opportunities, searchEvidence);
  const usedLiveSearch = searchEvidence.some((items) => items.length > 0);
  return createRadarRun({ mode: usedLiveSearch ? "topic-live-search-plus-curated-evidence" : "topic-curated-evidence", opportunities: enriched, previousRun });
}

function authorize(request: Request) {
  const configured = process.env.INVESTMENT_AGENT_API_KEY;
  if (!configured) return true;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${configured}`;
}

function shouldRunRadar(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("run radar")
    || normalized.includes("scan")
    || normalized.includes("refresh radar")
    || normalized.includes("find me opportunities")
    || normalized.includes("find opportunities")
    || normalized.includes("opportunities to invest")
    || normalized.includes("investment opportunities");
}

export async function POST(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as {
    message?: string;
    messages?: AgentChatMessage[];
    profile?: InvestmentProfile;
    latestRun?: RadarRun;
    selectedItem?: ResearchItem;
  };

  const message = body.message?.trim() || "Summarize the latest research state.";
  const profile = body.profile ?? defaultProfile;
  const userMessage = createAgentChatMessage("user", message);
  let run = body.latestRun;
  let content: string;

  if (shouldRunRadar(message)) {
    run = await runRadar(profile, body.latestRun, message);
    content = summarizeRunForChat(run);
  } else {
    content = answerAgentChat({ message, messages: body.messages, latestRun: run, selectedItem: body.selectedItem, profile });
  }

  const agentMessage = createAgentChatMessage("agent", content);
  return NextResponse.json({
    agent: "investment-intelligence-chat",
    telegramReady: true,
    userMessage,
    agentMessage,
    run,
    disclaimer: "Research support only. No financial advice, broker connection, or trade execution."
  });
}
