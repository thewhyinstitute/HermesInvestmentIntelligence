import { freshness, priceEarnings, scenarioReturn, type MarketResponse } from "./market-data";
import { evaluateRecommendation } from "./recommendations";
import { isBriefAssumptions } from "./brief-validation";
import type { BriefAssumptions, DecisionBriefSnapshot, InvestmentProfile, ResearchItem } from "./types";

export const defaultBriefAssumptions: BriefAssumptions = { years: 3, annualCash: 0 };
const percent = (n: number) => `${(n * 100).toFixed(2)}%`;

export function buildDecisionBrief(item: ResearchItem, profile: InvestmentProfile, assumptions: BriefAssumptions, market?: MarketResponse, now = new Date()) {
  const rec = item.recommendation;
  const result = market?.result;
  const matching = result && result.symbol === rec?.symbol && rec?.currency === "USD" ? result : undefined;
  const quote = matching?.quote ?? rec?.quote;
  const quoteFresh = !!quote && Number.isFinite(quote.price) && quote.price > 0 && /^https:\/\//.test(quote.sourceUrl) && freshness(quote.asOf, 4, now) === "fresh";
  const facts: string[] = [];
  const gaps: string[] = [];
  const validAssumptions = isBriefAssumptions(assumptions);
  if (!validAssumptions) gaps.push("Correct the invalid numerical scenario assumptions.");
  if (market?.result && rec?.currency !== "USD") gaps.push("The connected instrument feed is in USD; resolve the quote-currency mismatch.");
  if (quote) facts.push(`End-of-day price: ${quote.price} ${rec?.currency ?? "USD"}, dated ${quote.asOf} (${quoteFresh ? "fresh" : "stale or invalid"}).`);
  else gaps.push("A verified dated market price is missing.");
  if (quote && !quoteFresh) gaps.push("Refresh the stale market price before considering an entry.");
  const fund = matching?.fundamentals;
  if (fund?.kind === "company") {
    const pe = priceEarnings(quote?.price, fund.eps);
    if (fund.eps !== undefined) facts.push(`Provider EPS: ${fund.eps}; latest reported quarter ${fund.periodEnd ?? "undated"}; snapshot fetched ${matching?.fetchedAt}.`);
    if (pe !== undefined) facts.push(`Calculated price/provider EPS: ${pe.toFixed(1)}x. This does not establish fair value.`);
    if (freshness(fund.periodEnd, 135, now) !== "fresh") gaps.push("Company earnings period is stale or undated.");
    if (fund.eps === undefined || fund.eps <= 0) gaps.push("Positive earnings inputs for a meaningful P/E are missing.");
  } else if (fund?.kind === "etf") {
    if (fund.expenseRatio !== undefined) facts.push(`Provider net expense ratio: ${percent(fund.expenseRatio)}; snapshot fetched ${matching?.fetchedAt}.`);
    else gaps.push("ETF fees are unavailable.");
    gaps.push("ETF holdings and fee effective dates are unverified; check the issuer.");
    if (fund.holdings.length) facts.push(`Provider top holdings (undated): ${fund.holdings.map(h => `${h.symbol} ${percent(h.weight)}`).join(", ")}.`);
  } else gaps.push("Instrument-specific fundamentals or fund structure are unavailable.");
  if (fund && freshness(matching?.fetchedAt.slice(0, 10), 7, now) !== "fresh") gaps.push("Refresh the saved fundamentals snapshot.");
  if (market?.treasury) {
    const treasury = market.treasury;
    if (treasury.threeMonth !== undefined) facts.push(`US Treasury 3-month par yield: ${treasury.threeMonth}%, dated ${treasury.asOf}. Not an ETF yield or guaranteed return.`);
    if (freshness(treasury.asOf, 7, now) !== "fresh") gaps.push("Treasury benchmark is stale.");
  }
  const entry = assumptions.entryPrice ?? quote?.price;
  const validOrder = assumptions.bearPrice !== undefined && assumptions.basePrice !== undefined && assumptions.bullPrice !== undefined
    && assumptions.bearPrice <= assumptions.basePrice && assumptions.basePrice <= assumptions.bullPrice;
  if (!validOrder) gaps.push("Enter ordered bear, base and bull ending prices; none are estimated for you.");
  const scenarios = (["bear", "base", "bull"] as const).map(name => {
    const terminal = assumptions[`${name}Price`];
    return { name, terminal, returns: entry !== undefined && terminal !== undefined && validOrder && validAssumptions ? scenarioReturn(entry, terminal, assumptions.years, assumptions.annualCash) : undefined };
  });
  const base = scenarios[1].returns; const bear = scenarios[0].returns;
  const concerns: string[] = [];
  if (base && assumptions.requiredAnnualReturn !== undefined && base.annualized < assumptions.requiredAnnualReturn / 100) concerns.push("Your base scenario falls below your required annual return.");
  if (bear && assumptions.maxBearLoss !== undefined && bear.total < -assumptions.maxBearLoss / 100) concerns.push("Your bear scenario exceeds your maximum acceptable loss.");
  if (assumptions.requiredAnnualReturn === undefined || assumptions.maxBearLoss === undefined) gaps.push("Set your return hurdle and bear-case loss limit to compare the scenarios.");
  const evaluation = evaluateRecommendation(item, profile, now);
  gaps.push(...evaluation.blockers);
  const holdingsPending = !profile.holdingsNotes?.trim() || freshness(profile.holdingsReviewedAt, 30, now) !== "fresh";
  const conclusion = evaluation.stance === "avoid" ? "Avoid under your current rules"
    : !quoteFresh ? "Wait for current data"
    : concerns.length ? "Wait: scenario conflicts with your limits"
    : gaps.length ? "Research further before an investment decision"
    : "Ready for your human review; not a buy instruction";
  const reasons = [rec?.rationale || item.thesis, ...concerns,
    ...(base && bear && assumptions.requiredAnnualReturn !== undefined && assumptions.maxBearLoss !== undefined && !concerns.length ? ["Your entered scenarios meet your thresholds. This does not verify the assumptions or authorize investing."] : [])];
  return { conclusion, facts, gaps: [...new Set(gaps)], reasons, scenarios, quote, holdingsPending,
    conditions: rec?.entryCondition || "An entry condition has not been defined.",
    portfolioFit: holdingsPending ? "Pending your holdings. No personalized suitability or allocation conclusion is made." : item.fitNotes };
}

export function captureDecisionBrief(item: ResearchItem, profile: InvestmentProfile, assumptions: BriefAssumptions, market?: MarketResponse, now = new Date()): DecisionBriefSnapshot {
  if (!item.recommendation) throw new Error("A specific investment instrument is required.");
  if (!isBriefAssumptions(assumptions)) throw new Error("Invalid scenario assumptions.");
  const brief = buildDecisionBrief(item, profile, assumptions, market, now);
  return structuredClone({ id: `brief-${now.getTime()}`, capturedAt: now.toISOString(), symbol: item.recommendation.symbol,
    conclusion: brief.conclusion, reasons: brief.reasons, gaps: brief.gaps, facts: brief.facts, assumptions,
    recommendation: { ...item.recommendation, quote: brief.quote }, thesis: item.thesis, risks: item.risks, sources: item.sources, marketData: market });
}

export function compareBriefs(previous: DecisionBriefSnapshot, current: DecisionBriefSnapshot) {
  const changes: string[] = [];
  const before = previous.recommendation.quote; const after = current.recommendation.quote;
  if (before && after && before.price > 0 && before.price !== after.price) changes.push(`Price changed ${percent(after.price / before.price - 1)} (${before.asOf} to ${after.asOf}).`);
  else if (before && after && before.asOf !== after.asOf) changes.push(`Price observation date changed ${before.asOf} -> ${after.asOf}; price unchanged.`);
  if (Boolean(before) !== Boolean(after)) changes.push(after ? "A dated price is now available." : "Current price is now unavailable.");
  if (previous.conclusion !== current.conclusion) changes.push(`Assessment changed: ${previous.conclusion} -> ${current.conclusion}.`);
  if (previous.thesis !== current.thesis || previous.recommendation.rationale !== current.recommendation.rationale || previous.recommendation.entryCondition !== current.recommendation.entryCondition
    || previous.recommendation.valuation !== current.recommendation.valuation || JSON.stringify(previous.risks) !== JSON.stringify(current.risks)
    || JSON.stringify(previous.recommendation.thesisBreakers) !== JSON.stringify(current.recommendation.thesisBreakers)) changes.push("Investment thesis, valuation, entry condition or risk assumptions changed.");
  const evidence = (snapshot: DecisionBriefSnapshot) => JSON.stringify(snapshot.sources.map(s => [s.url, s.checkedAt, s.quality, s.claim]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if (evidence(previous) !== evidence(current)) changes.push("Evidence sources, dates, claims or quality changed.");
  const scenarioValues = (value: BriefAssumptions) => [value.entryPrice, value.years, value.annualCash, value.bearPrice, value.basePrice, value.bullPrice, value.requiredAnnualReturn, value.maxBearLoss];
  if (JSON.stringify(scenarioValues(previous.assumptions)) !== JSON.stringify(scenarioValues(current.assumptions))) changes.push("Your scenario assumptions or thresholds changed.");
  if (JSON.stringify(previous.facts) !== JSON.stringify(current.facts)) changes.push("Market facts or data freshness changed.");
  if (JSON.stringify(previous.gaps) !== JSON.stringify(current.gaps)) changes.push("Pending checks changed; review freshness and missing inputs.");
  return changes;
}
