import type { InvestmentProfile, ResearchItem } from "./types";

export function profileIsComplete(profile: InvestmentProfile) {
  return !!profile.profileCompletedAt && !!profile.goal && !!profile.baseCurrency && !!profile.experience
    && Number.isFinite(profile.investmentBudget) && (profile.investmentBudget ?? 0) > 0 && !!profile.liquidityNeed.trim();
}
export function profileFitReason(item: ResearchItem, profile: InvestmentProfile) {
  if (!profileIsComplete(profile)) return "Complete your profile to assess whether this matches your goals.";
  const volatile = /stock|equity|gold|crypto/i.test(item.assetClass);
  if (profile.horizon === "0-1y" && volatile) return "Not a natural match for money you need within one year: its price can fall before you need the cash.";
  if ((profile.goal === "preserve_capital" || profile.riskLevel === "low") && /stock|equity|crypto/i.test(item.assetClass)) return "Potentially too volatile for your capital-preservation or low-risk preference.";
  if (profile.goal === "income" && /gold/i.test(item.assetClass)) return "Gold does not generate cash income, so it does not directly meet your income goal.";
  if (profile.goal === "preserve_capital" && /gold/i.test(item.assetClass)) return "Gold can diversify exposures, but its price can fall substantially; it is not principal protection.";
  if (profile.baseCurrency !== item.recommendation?.currency) return `${item.recommendation?.currency ?? "Foreign-currency"} exposure adds currency risk against your ${profile.baseCurrency} spending needs.`;
  if (profile.goal === "growth" && /bond/i.test(item.assetClass)) return "A cash or liquidity comparison, not the main driver of your long-term growth goal.";
  if (profile.goal === "preserve_capital" && /bond/i.test(item.assetClass)) return "Short-duration Treasury exposure is a candidate for your preservation goal, but this fund is not an insured deposit and costs still matter.";
  return "A candidate to compare with your stated goals and horizon. Portfolio overlap still needs a holdings review.";
}

export function profilePriorityAdjustment(item: ResearchItem, profile: InvestmentProfile) {
  if (!profileIsComplete(profile)) return 0;
  const equity = /stock|equity|crypto/i.test(item.assetClass);
  const gold = /gold/i.test(item.assetClass);
  const bond = /bond/i.test(item.assetClass);
  if (profile.horizon === "0-1y" && (equity || gold)) return -100;
  if ((profile.goal === "preserve_capital" || profile.riskLevel === "low") && equity) return -80;
  if (profile.goal === "income" && gold) return -60;
  if (profile.goal === "preserve_capital" && bond) return 30;
  if (profile.goal === "growth" && equity && profile.horizon !== "0-1y") return 15;
  return 0;
}
