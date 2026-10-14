import type { InvestmentProfile, ResearchItem } from "./types";
import { createStructuredMemoDraft } from "./workflows";

// Instrument identity and structure only; these are not current-price buy calls.
const universe = [
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", asset: "Equity ETF", theme: "Nasdaq growth",
    url: "https://www.invesco.com/us/financial-products/etfs/product-detail?audienceType=Investor&productId=ETF-QQQM",
    fact: "Tracks the Nasdaq-100 index; a growth-oriented equity fund, not a whole-market portfolio.",
    why: "A fund is one way to access Nasdaq businesses without choosing a single company. Compare its concentration with a global equity fund.",
    timing: "Only attractive if the underlying earnings and valuation justify the price; popularity of AI alone is not an entry signal.",
    risks: ["Large-cap growth concentration", "Equity drawdowns", "USD exposure versus spending currency"],
    breakers: ["Holdings overlap makes your total technology exposure excessive", "The valuation case relies on unsustainable earnings growth"],
    alternative: "A broad global equity ETF", role: "Long-term growth; assess overlap with existing technology holdings." },
  { symbol: "GRID", name: "First Trust NASDAQ Clean Edge Smart Grid Infrastructure Index Fund", asset: "Thematic equity ETF", theme: "AI power and grid infrastructure",
    url: "https://www.ftportfolios.com/Retail/Etf/EtfSummary.aspx?Ticker=GRID",
    fact: "Provides exposure to companies involved in smart-grid and electrical infrastructure activities.",
    why: "A diversified grid-equipment exposure is a candidate for the physical infrastructure behind electrification, rather than another direct AI chip bet.",
    timing: "Verify holdings, revenue exposure, backlog conversion and valuations before paying for the infrastructure narrative.",
    risks: ["Thematic concentration", "Industrial cycle and permitting delays", "Indirect AI exposure and valuation crowding"],
    breakers: ["Actual holdings do not provide the desired grid exposure", "Backlog fails to convert into profitable revenue"],
    alternative: "A broad industrials ETF", role: "Satellite equity exposure, not a substitute for diversification." },
  { symbol: "IAU", name: "iShares Gold Trust", asset: "Gold trust", theme: "Gold and resilience",
    url: "https://www.ishares.com/us/products/239561/ishares-gold-trust-fund",
    fact: "A gold trust intended to reflect the performance of gold, with vehicle expenses and structural considerations.",
    why: "Worth comparing as a non-equity diversifier if your aim is resilience rather than income or short-term speculation.",
    timing: "Compare gold's current price and real-rate environment with cash and bonds; a diversification thesis is not proof of a cheap entry.",
    risks: ["No operating cash flow", "Gold can fall alongside other assets", "Real-rate, currency and vehicle-cost risk"],
    breakers: ["You need income or near-term principal certainty", "The position worsens rather than diversifies your actual exposures"],
    alternative: "Physical gold or a locally accessible gold vehicle", role: "Potential diversifier; its role depends on actual holdings and currency needs." },
  { symbol: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", asset: "Short-duration bond ETF", theme: "Capital preservation",
    url: "https://www.ishares.com/us/products/314116/ishares-0-3-month-treasury-bond-etf",
    fact: "Holds short-term US Treasury exposure; this is a USD bond fund, not an insured deposit or local-currency cash.",
    why: "A candidate to compare for money intended to stay in USD with short-duration exposure while you assess longer-term investments.",
    timing: "Compare current net yield, spread and fees with direct bills and cash alternatives in your spending currency. Currency risk can dominate a yield advantage.",
    risks: ["Reinvestment risk as yields change", "Currency mismatch if your spending needs are not in USD", "Fund price, fees and tax treatment"],
    breakers: ["The money is needed soon in a different currency", "Net yield after costs does not beat accessible alternatives"],
    alternative: "Singapore T-bills or direct US Treasury bills", role: "Only a liquidity candidate when the currency matches your needs." },
  { symbol: "NVDA", name: "NVIDIA Corporation", asset: "Stock", theme: "AI compute",
    url: "https://investor.nvidia.com/financial-info/financial-reports/default.aspx",
    fact: "Nasdaq-listed NVIDIA (NVDA); current financial reports are the primary starting point for business analysis.",
    why: "A direct AI-compute business candidate to compare with diversified funds. Business strength and an attractive stock price are separate questions.",
    timing: "Review current earnings, margins, customer concentration and scenario-implied valuation. No price target is assumed here.",
    risks: ["Single-company and customer concentration", "Competition and export restrictions", "High expectations and capex cyclicality"],
    breakers: ["Sustained margin erosion undermines earnings assumptions", "Customers reduce spending or substitute competing systems"],
    alternative: "QQQM or a diversified semiconductor ETF", role: "Single-stock satellite; check existing fund look-through exposure first." },
];

export function buildInvestmentCandidates(profile: InvestmentProfile, topic = ""): ResearchItem[] {
  const normalized = topic.toLowerCase();
  const selected = /gold/.test(normalized) ? universe.filter(x => x.symbol === "IAU")
    : /grid|power|electric/.test(normalized) ? universe.filter(x => x.symbol === "GRID")
    : /treasury|bill|bond|cash/.test(normalized) ? universe.filter(x => x.symbol === "SGOV")
    : /nasdaq|stock|compute|semiconductor/.test(normalized) ? universe.filter(x => ["QQQM", "NVDA"].includes(x.symbol)) : universe;
  return selected.map(asset => {
    const item = createStructuredMemoDraft(asset.name, asset.theme, asset.asset, asset.timing);
    return { ...item, id: `candidate-${asset.symbol.toLowerCase()}`, thesis: asset.why,
      fitNotes: `${asset.role} Profile: ${profile.riskLevel}, ${profile.horizon}. Actual holdings must be reviewed.`,
      risks: asset.risks, assumptions: ["Instrument availability, costs and tax treatment must be checked for your account."],
      openQuestions: ["What is the current price and instrument-specific valuation case?", "How does this overlap with my actual holdings and liquidity needs?"],
      sources: [{ id: `catalog-${asset.symbol}`, title: `${asset.symbol} official instrument information`, url: asset.url,
        sourceType: "issuer" as const, quality: "high" as const, checkedAt: "2026-10-13", claim: asset.fact }],
      recommendation: { symbol: asset.symbol, venue: asset.symbol === "IAU" || asset.symbol === "SGOV" ? "NYSE Arca" : "NASDAQ",
        currency: "USD", stance: "watch" as const, rationale: asset.why, valuation: "",
        entryCondition: asset.timing, thesisBreakers: asset.breakers, alternatives: [asset.alternative] } };
  });
}

export function investmentSearchQuery(item: ResearchItem) {
  return `${item.recommendation?.symbol ?? item.title} latest valuation earnings yield risks official filing factsheet ${new Date().getUTCFullYear()}`;
}
