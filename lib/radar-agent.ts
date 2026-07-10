import type { EvidenceSource, InvestmentProfile, ResearchItem } from "./types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function source(id: string, title: string, url: string, claim: string, sourceType: EvidenceSource["sourceType"] = "analysis", quality: EvidenceSource["quality"] = "medium"): EvidenceSource {
  return { id, title, url, sourceType, checkedAt: today(), quality, claim };
}

export function mergeRadarEvidence(existing: EvidenceSource[], incoming: EvidenceSource[]) {
  const byUrl = new Map<string, EvidenceSource>();
  [...existing, ...incoming].forEach((item) => {
    if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  });
  return [...byUrl.values()];
}

function opportunity(input: {
  title: string;
  assetClass: string;
  theme: string;
  whyNow: string;
  thesis: string;
  assumptions: string[];
  openQuestions: string[];
  risks: string[];
  fitNotes: string;
  sources: EvidenceSource[];
}): ResearchItem {
  const id = `radar-${slugify(input.title)}-${Date.now()}`;
  return {
    id,
    title: input.title,
    assetClass: input.assetClass,
    theme: input.theme,
    status: "memo",
    whyNow: input.whyNow,
    thesis: input.thesis,
    assumptions: input.assumptions,
    openQuestions: input.openQuestions,
    risks: input.risks,
    fitNotes: input.fitNotes,
    decision: "research_deeper",
    confidence: "medium",
    targetAllocation: "Research only; no allocation proposed.",
    reviewCadence: "Review after evidence refresh or material market change",
    nextReviewAt: today(),
    createdAt: today(),
    sources: input.sources,
    agentDrafts: [{
      id: `draft-${id}`,
      createdAt: new Date().toISOString(),
      channel: "web",
      status: "draft",
      request: `Autonomous radar surfaced ${input.title}`,
      facts: input.sources.map((item) => `${item.title}: ${item.claim}`),
      assumptions: input.assumptions,
      risks: input.risks,
      suggestedNextStep: "Human review required: verify source details, compare investable vehicles, and resolve open questions before any decision.",
      humanReviewRequired: true
    }],
    decisionSnapshots: []
  };
}

export function buildFallbackRadarOpportunities(profile: InvestmentProfile): ResearchItem[] {
  const geographicFit = profile.geography.includes("Singapore") ? "Includes Singapore/Asia relevance where useful." : "Global-first framing based on profile geography.";
  return [
    opportunity({
      title: "AI power and grid infrastructure",
      assetClass: "Theme / ETF watchlist",
      theme: "AI infrastructure",
      whyNow: "AI data center buildout is shifting attention from chips alone toward power, cooling, grid capacity, and electrical infrastructure.",
      thesis: "A broader AI infrastructure lens may capture bottlenecks around electricity, grid equipment, cooling, and data center supply chains rather than only semiconductor winners.",
      assumptions: ["AI capex remains durable enough to drive infrastructure demand", "Investable exposure can be diversified rather than single-stock dependent", geographicFit],
      openQuestions: ["Which ETFs or funds have clean exposure to grid/data-center infrastructure?", "How much overlap exists with existing mega-cap tech exposure?", "Are valuations already pricing in the AI infrastructure story?"],
      risks: ["Theme crowding", "Valuation risk", "Regulatory/permitting delays", "Indirect exposure inside broad funds"],
      fitNotes: "Potentially aligned with AI/product interests, but concentration and valuation need guardrails.",
      sources: [
        source("src-iea-electricity", "IEA electricity and data centre analysis", "https://www.iea.org/reports/electricity-2024", "Use to verify electricity demand and data-centre load assumptions.", "analysis", "high"),
        source("src-iea-ai-energy", "IEA commentary on AI and energy demand", "https://www.iea.org/commentaries/what-the-data-centre-and-ai-boom-could-mean-for-the-energy-sector", "Use to test whether AI/data-centre energy claims are material or overstated.", "analysis", "high")
      ]
    }),
    opportunity({
      title: "Short-duration bond and T-bill ladder",
      assetClass: "Bonds / Cash-like",
      theme: "Capital preservation",
      whyNow: "Short-duration yields can support liquidity and optionality while riskier themes are researched.",
      thesis: "A short-duration sleeve may reduce idle-cash drag while preserving flexibility, but currency, platform fees, and reinvestment risk must be checked.",
      assumptions: ["Liquidity and optionality remain valuable", "Short-duration instruments match near-term runway needs", "Currency exposure can be managed"],
      openQuestions: ["Which currency should the liquidity sleeve use?", "What platform spreads, fees, and tax treatment apply?", "What maturity ladder best protects optionality?"],
      risks: ["Reinvestment risk", "Currency mismatch", "Inflation risk", "Platform/product fees"],
      fitNotes: "Strong conceptual fit for runway and downside management; product selection still needs evidence.",
      sources: [
        source("src-us-treasury-rates", "US Treasury daily rates", "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView", "Use to verify current Treasury yield context before comparing cash-like instruments.", "market_data", "high"),
        source("src-mas-bills", "Monetary Authority of Singapore bills and bonds", "https://www.mas.gov.sg/bonds-and-bills", "Use to compare Singapore government bill/bond options and local-currency context.", "regulator", "high")
      ]
    }),
    opportunity({
      title: "Gold as resilience hedge",
      assetClass: "Commodity / ETF",
      theme: "Defensive allocation",
      whyNow: "Gold can become relevant when real rates, currency risk, geopolitics, or equity drawdown protection are under review.",
      thesis: "A small gold sleeve may diversify equity-heavy exposure, but vehicle choice, opportunity cost, and currency effects matter.",
      assumptions: ["The objective is resilience, not short-term speculation", "Gold vehicle costs and liquidity are acceptable", "Allocation size remains bounded"],
      openQuestions: ["Physical, ETF, or fund vehicle?", "What role should gold play versus short-duration bonds?", "How does currency exposure affect the hedge?"],
      risks: ["No cash flow", "Real-rate sensitivity", "Currency effects", "Storage or fund structure costs"],
      fitNotes: "May fit as a defensive diversifier, but should be compared against liquidity and bond sleeves.",
      sources: [
        source("src-world-gold-council", "World Gold Council research", "https://www.gold.org/goldhub/research", "Use as a starting point for gold market context and portfolio-role claims.", "analysis", "medium"),
        source("src-spdr-gold", "SPDR Gold Shares fund information", "https://www.spdrgoldshares.com/", "Use to verify ETF structure, costs, and gold exposure if considering an ETF vehicle.", "issuer", "high")
      ]
    })
  ];
}

export function buildRadarSearchQueries(profile: InvestmentProfile) {
  return [
    `AI data center power grid infrastructure ETF opportunity ${profile.geography}`,
    `short duration Treasury bills cash management Singapore investor ${profile.horizon}`,
    `gold ETF portfolio hedge real rates evidence ${profile.riskLevel} risk profile`
  ];
}
