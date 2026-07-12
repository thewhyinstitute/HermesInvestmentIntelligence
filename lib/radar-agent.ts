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
  confidence?: ResearchItem["confidence"];
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
    confidence: input.confidence ?? "medium",
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

function normalizeTopic(value: string) {
  return value.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
}

export function isAiPowerGridTopic(value: string) {
  const topic = normalizeTopic(value);
  return topic.includes("ai")
    && (topic.includes("power") || topic.includes("electricity") || topic.includes("energy"))
    && (topic.includes("grid") || topic.includes("infrastructure") || topic.includes("data center") || topic.includes("datacenter"));
}

export function buildTopicRadarOpportunities(profile: InvestmentProfile, prompt: string): ResearchItem[] {
  if (!isAiPowerGridTopic(prompt)) return buildFallbackRadarOpportunities(profile);

  const geographicFit = profile.geography.includes("Singapore")
    ? "Check whether global exposure complements Singapore/Asia constraints and currency needs."
    : "Check geographic concentration and currency exposure against the profile.";

  return [
    opportunity({
      title: "Grid equipment and electrification suppliers",
      assetClass: "Theme / ETF or stock watchlist",
      theme: "AI power infrastructure",
      whyNow: "AI data-center growth increases scrutiny on transmission capacity, transformers, switchgear, substations, and grid modernization bottlenecks.",
      thesis: "The investable angle may be less about AI models and more about the electrical equipment layer needed to connect and manage large new loads.",
      assumptions: ["Data-center electricity demand continues growing", "Grid upgrade capex remains durable across cycles", geographicFit],
      openQuestions: ["Which ETFs or listed suppliers provide clean exposure without excessive single-name risk?", "How much of the story is already priced into electrical equipment valuations?", "Which regions have the clearest grid capex visibility?"],
      risks: ["Valuation crowding", "Project delays and permitting", "Cyclical industrial demand", "Indirect or diluted ETF exposure"],
      fitNotes: "Relevant to AI infrastructure interests, but should be sized as research-only until vehicle quality, valuation, and overlap are checked.",
      confidence: "high",
      sources: [
        source("src-iea-electricity-2024-grid", "IEA Electricity 2024", "https://www.iea.org/reports/electricity-2024", "Use to verify electricity demand, grid, and data-centre load assumptions.", "analysis", "high"),
        source("src-doe-transmission", "U.S. DOE transmission needs study", "https://www.energy.gov/gdo/national-transmission-needs-study", "Use to test whether transmission constraints are an official infrastructure bottleneck.", "regulator", "high"),
        source("src-iea-grids", "IEA electricity grids and secure energy transitions", "https://www.iea.org/reports/electricity-grids-and-secure-energy-transitions", "Use to validate grid investment needs and bottlenecks.", "analysis", "high")
      ]
    }),
    opportunity({
      title: "Data-center power, cooling, and energy-management infrastructure",
      assetClass: "Theme / ETF or stock watchlist",
      theme: "AI data-center infrastructure",
      whyNow: "AI workloads raise data-center density, making power distribution, backup power, cooling, and energy-management systems more strategically important.",
      thesis: "Infrastructure vendors around power distribution, thermal management, and data-center operations may benefit from AI capex even when semiconductor winners rotate.",
      assumptions: ["AI capex keeps translating into physical data-center buildout", "Power and cooling constraints remain material", "Exposure can be diversified across vendors or funds"],
      openQuestions: ["Which companies or ETFs have direct revenue exposure to data-center power and cooling?", "What customer concentration exists around hyperscalers?", "Are margins protected or competed away?"],
      risks: ["Hyperscaler capex slowdown", "Supply-chain constraints", "Competition compressing margins", "High expectations embedded in prices"],
      fitNotes: "Strong thematic fit, but needs evidence on investable vehicle purity and valuation before any decision.",
      confidence: "high",
      sources: [
        source("src-iea-ai-energy", "IEA commentary on AI and energy demand", "https://www.iea.org/commentaries/what-the-data-centre-and-ai-boom-could-mean-for-the-energy-sector", "Use to test whether AI/data-centre energy claims are material or overstated.", "analysis", "high"),
        source("src-datacenters-doe", "U.S. DOE data centers and servers", "https://www.energy.gov/eere/buildings/data-centers-and-servers", "Use as official context for data-center energy efficiency and infrastructure constraints.", "regulator", "high"),
        source("src-uptime-institute", "Uptime Institute data center research", "https://uptimeinstitute.com/research", "Use as industry context for data-center capacity, resilience, and operations trends.", "analysis", "medium")
      ]
    }),
    opportunity({
      title: "Power generation and clean firm capacity for AI load growth",
      assetClass: "Utilities / infrastructure / energy watchlist",
      theme: "AI electricity supply",
      whyNow: "Large AI campuses can require dependable electricity supply, pushing investors to examine utilities, independent power producers, nuclear, renewables, storage, and gas capacity.",
      thesis: "AI power demand may support selected generation and utility infrastructure, but the opportunity depends heavily on regulation, contracts, fuel mix, and local grid constraints.",
      assumptions: ["AI load growth is durable enough to affect utility planning", "Regulated or contracted assets can capture economics", "Policy and permitting do not erase returns"],
      openQuestions: ["Which markets have approved load-growth capex rather than speculative narratives?", "Are there credible long-term contracts with hyperscalers?", "What fuel, regulatory, and ratepayer risks apply?"],
      risks: ["Regulatory disallowance", "Commodity/fuel risk", "Permitting delays", "Narrative-driven overvaluation"],
      fitNotes: "Potential portfolio diversifier versus pure tech exposure, but requires jurisdiction-level evidence and vehicle due diligence.",
      confidence: "medium",
      sources: [
        source("src-ferc-infrastructure", "FERC electric reliability and infrastructure", "https://www.ferc.gov/industries-data/electric", "Use to understand U.S. electricity market, reliability, and infrastructure context.", "regulator", "high"),
        source("src-eia-electricity", "U.S. EIA electricity data", "https://www.eia.gov/electricity/", "Use to verify electricity generation, demand, and market data before relying on the theme.", "market_data", "high"),
        source("src-iea-electricity-2024-supply", "IEA Electricity 2024", "https://www.iea.org/reports/electricity-2024", "Use to compare electricity demand growth and supply-side context.", "analysis", "high")
      ]
    })
  ];
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

export function buildRadarSearchQueries(profile: InvestmentProfile, prompt = "") {
  if (isAiPowerGridTopic(prompt)) {
    return [
      `AI data center electricity demand grid equipment transformers switchgear investment evidence ${profile.geography}`,
      `AI data center power cooling energy management infrastructure credible sources ${profile.geography}`,
      `AI electricity load growth utilities power generation grid infrastructure investment risk ${profile.horizon}`
    ];
  }
  return [
    `AI data center power grid infrastructure ETF opportunity ${profile.geography}`,
    `short duration Treasury bills cash management Singapore investor ${profile.horizon}`,
    `gold ETF portfolio hedge real rates evidence ${profile.riskLevel} risk profile`
  ];
}
