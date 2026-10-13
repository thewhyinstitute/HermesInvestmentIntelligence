import type { InvestmentProfile, InvestmentStance, ResearchItem } from "./types";
import { evaluateMemoTrust, reviewEvidenceSource, scorePortfolioFit } from "./workflows";

export const stanceLabels: Record<InvestmentStance, string> = {
  consider_buying: "Consider buying", accumulate: "Accumulate gradually",
  wait: "Wait", watch: "Watch", avoid: "Avoid",
};

function recent(value: string | undefined, days: number, now: Date) {
  const elapsed = now.getTime() - Date.parse(value ?? "");
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= days * 86400000;
}

export function evaluateRecommendation(item: ResearchItem, profile: InvestmentProfile, now = new Date()) {
  const recommendation = item.recommendation;
  const trust = evaluateMemoTrust(item);
  const fit = scorePortfolioFit(item, profile);
  const symbolExcluded = !!recommendation?.symbol && profile.excludedAssets.toUpperCase().split(/[,.;\n]/)
    .some(term => term.trim() === recommendation.symbol.toUpperCase());
  const usable = item.sources.filter(source => {
    const review = reviewEvidenceSource(source);
    return /^https:\/\//.test(source.url) && review.hostname !== "unverified-url"
      && review.warnings.length === 0 && source.quality !== "low" && recent(source.checkedAt, 30, now);
  });
  const domains = new Set(usable.map(source => new URL(source.url).hostname.replace(/^www\./, "")));
  const quote = recommendation?.quote;
  const quoteReady = !!quote && Number.isFinite(quote.price) && quote.price > 0
    && recent(quote.asOf, 4, now) && /^https:\/\//.test(quote.sourceUrl)
    && reviewEvidenceSource({ id: "quote", title: "Price", sourceType: "market_data", quality: "high", checkedAt: quote.asOf, claim: "Price", url: quote.sourceUrl }).hostname !== "unverified-url"
    && !/example\.com|replace-with/.test(quote.sourceUrl);
  const blockers = [
    !recommendation?.symbol.trim() || !recommendation?.venue.trim() || !recommendation?.currency.trim() ? "Choose a specific instrument, exchange and quote currency." : "",
    !quoteReady ? "Verify a current price and its dated source (within four days)." : "",
    !recommendation?.valuation.trim() ? "Document valuation or yield versus alternatives." : "",
    !recommendation?.rationale.trim() ? "Explain why this specific instrument is worth considering." : "",
    !recommendation?.entryCondition.trim() ? "Define the entry condition." : "",
    !recommendation?.thesisBreakers.length ? "Define what would invalidate the thesis." : "",
    !recent(recommendation?.reviewedAt, 30, now) ? "Complete a dated human recommendation review." : "",
    !recent(profile.holdingsReviewedAt, 30, now) || !profile.holdingsNotes?.trim() ? "Review your actual holdings, cash needs, currency and concentration." : "",
    domains.size < 2 ? "Verify fresh evidence from two independent source domains." : "",
    !usable.some(source => reviewEvidenceSource(source).isPrimary) ? "Verify an instrument-specific primary source." : "",
    ...trust.missingEvidence, ...trust.warnings,
    ...fit.blockers.filter(blocker => blocker.includes("exclusion")),
    symbolExcluded ? "This ticker is excluded by your profile." : "",
    profile.horizon === "0-1y" && /stock|equity|gold|crypto/i.test(item.assetClass) ? "Near-term money needs a liquidity and downside check before volatile assets." : "",
  ].filter(Boolean);
  let stance: InvestmentStance = recommendation?.stance ?? "watch";
  if (item.status === "rejected" || item.decision === "avoid" || symbolExcluded || fit.blockers.some(b => b.includes("exclusion"))) stance = "avoid";
  if ((stance === "consider_buying" || stance === "accumulate") && blockers.length) stance = "wait";
  return { item, stance, label: stanceLabels[stance], blockers: [...new Set(blockers)], ready: blockers.length === 0,
    fit, trust, quoteReady, rank: (stance === "avoid" ? -1000 : 0) + trust.score + fit.score - blockers.length * 5 };
}

export function rankRecommendations(items: ResearchItem[], profile: InvestmentProfile, now = new Date()) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.recommendation?.symbol.toUpperCase() || item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(item => evaluateRecommendation(item, profile, now)).sort((a, b) => b.rank - a.rank);
}
